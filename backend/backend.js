const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');
const cors = require('cors');
const cookieParser = require("cookie-parser");
const http = require('http');
const { UserCollection, auth, db, WalkwayCollection, InterestCollection } = require('./firebase-config');
const {sendSignInLinkToEmail, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } = require('firebase/auth');
const { getStorage } = require("firebase/storage");
const { addDoc, getDocs, updateDoc, doc, collection, query, where , getDoc, setDoc, arrayUnion} = require('firebase/firestore');
const { c, u } = require('tar');
// get markers from walkways/marker.json
const markers = require('./walkways/markers.json');
const app = express();

const multer = require('multer');
const { ref, uploadBytes, getDownloadURL } = require('firebase/storage');
const { v4: uuidv4 } = require('uuid'); // For unique file names
const upload = multer({ storage: multer.memoryStorage() });
// create a global variable to store the user data
let userData = {};

// Middleware for parsing JSON and handling CORS
app.use(express.json());
app.use(cors({
    origin: 'http://localhost:3000', // Replace with your frontend URL
    credentials: true, // This allows the server to accept credentials (cookies, authorization headers)
}));

app.use(session({
    secret: 'yoursecretkey',
    resave: true,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 * 24} // one day
}));
app.use(cookieParser());
//------------------------------- Get Users --------------------------------
app.get("/", async (req, res) => {
    try {
        const snapshot = await getDocs(UserCollection); 
        const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.send(users);
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).send("Error fetching users");
    }
});

//------------------------------- Create User --------------------------------
app.post("/create", async (req, res) => {
    const data = req.body;
    try {
        await addDoc(UserCollection, data);
        res.send("User added");
    } catch (error) {
        console.error("Error adding user:", error);
        res.status(500).send("Error adding user");
    }
});
//----------------------------- Password email reset -------------------------------
app.post('/forgotPassword', async (req, res) => {
    const { email } = req.body;

    try {
        await sendPasswordResetEmail(auth, email);
        res.status(200).json({ message: 'Password reset email sent successfully.' });
    } catch (error) {
        console.error('Error sending password reset email:', error);
        res.status(500).json({ error: 'Failed to send password reset email.' });
    }
});


//------------------------------- Google Auth --------------------------------
passport.use(new GoogleStrategy({
    clientID: '278695263875-beaordgc7ppbotq6dhk33c99b7kg42f2.apps.googleusercontent.com',
    clientSecret: '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',
    callbackURL: "http://localhost:8080/auth/google/callback"
}, (accessToken, refreshToken, profile, done) => {
    return done(null, profile);
}));

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((obj, done) => {
    done(null, obj);
});

// Google OAuth routes
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/signin' }), (req, res) => {
    res.redirect('/success');
});

//------------------------------- Sign in --------------------------------
app.post('/signin', async (req, res) => {
    const { email, password } = req.body;

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Procurar o utilizador no Firestore pelo email
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', email));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            return res.status(404).send({ message: 'User not found in Firestore.' });
        }

        const userDoc = querySnapshot.docs[0].data();

        // Verifica se é autoridade local com status pendente
        if (userDoc.role === 'Staff' && userDoc.status === 'pending') {
            return res.status(403).send({ message: 'Your account has not yet been approved by the administration.' });
        }

        // Guardar sessão e devolver sucesso
        req.session.user = { email: user.email, uid: user.uid, role: userDoc.role };
        req.session.save((err) => {
            if (err) {
                return res.status(500).send({ message: 'Session save failed' });
            }
            res.status(200).send({ message: 'Login successful', user: { email: user.email, role: userDoc.role } });
            userData = user;
        });

        console.log('User logged in:', user.email);

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).send({ message: 'Login failed' });
    }
});


//------------------------------- Get user's data --------------------------------
app.get('/user', async (req, res) => {
    const { email } = req.query;

    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', email));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            // Get the first document found
            const userDoc = querySnapshot.docs[0];
            const userData = userDoc.data();
            
            res.status(200).json({
                id: userDoc.id,  // Include document ID if needed
                ...userData      // Include all user fields from Firestore
            });
            console.log('User data fetched:', userData);
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    } catch (error) {
        console.error('Error fetching user data:', error);
        res.status(500).json({ error: 'Error fetching user data' });
    }
});

//------------------------------- Update Local Authority Profile --------------------------------

app.post('/updateLocalAuthorityProfile', async (req, res) => {
    const email = req.session.user?.email || userData.email;
    const { institutionName, registrationDate, positionType, location } = req.body;

    if (!email) {
        return res.status(401).json({ error: 'Utilizador não autenticado.' });
    }

    try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', email));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            return res.status(404).json({ error: 'Utilizador não encontrado.' });
        }

        const userDocRef = querySnapshot.docs[0].ref;

        const updateData = {};
        if (institutionName !== undefined) updateData.institutionName = institutionName;
        if (registrationDate !== undefined) updateData.registrationDate = registrationDate;
        if (positionType !== undefined) updateData.positionType = positionType;
        if (location !== undefined) updateData.location = location;

        await updateDoc(userDocRef, updateData);

        res.status(200).json({ message: 'Perfil da autoridade local atualizado com sucesso.' });
        console.log(`🏛️ Perfil da autoridade local atualizado para ${email}`);
    } catch (error) {
        console.error('Erro ao atualizar perfil da autoridade local:', error);
        res.status(500).json({ error: 'Erro ao atualizar perfil da autoridade local.' });
    }
});

//------------------------------- Approve City Council --------------------------------
app.post('/approveCityCouncil', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email is required.' });
    }

    try {
        const q = query(UserCollection, where('email', '==', email));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const userDocRef = snapshot.docs[0].ref;

        // Atualiza o estado para "approved"
        await updateDoc(userDocRef, { status: 'approved' });

        // Envia link de login por email
        const actionCodeSettings = {
            url: 'http://localhost:3000/login', // ou a página real da tua app
            handleCodeInApp: true
        };

        await sendSignInLinkToEmail(auth, email, actionCodeSettings);

        console.log(`City council user approved and email sent: ${email}`);
        res.status(200).json({ message: 'User approved and email sent.' });
    } catch (error) {
        console.error('Error approving city council user:', error);
        res.status(500).json({ error: 'Failed to approve user.' });
    }
});


//------------------------------- Sign up --------------------------------
app.post('/signup', async (req, res) => {
    const { email, password, name, birthdate, userId, role } = req.body;

    if (!email || !password || !name || !birthdate || !userId || !role) {
        return res.status(400).send({ message: 'All fields are required' });
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await addDoc(UserCollection, { email, name, birthdate, userId, role });

        res.status(201).json({ message: 'User created successfully', user: { email, name, birthdate, userId, role } });
    } catch (error) {
        console.error('Error creating user:', error.message);
        res.status(500).json({ message: 'Sign up failed: ' + error.message });
    }
});

//------------------------------- Sign up Pending (City Council) --------------------------------
app.post('/signup-pending', async (req, res) => {
    const {
        email,
        password,
        userId,
        institutionName,
        role,
        status,
        registrationDate,
        positionType,
        location
    } = req.body;

    console.log('Received signup-pending body:', req.body);

    // Verificação dos campos obrigatórios
    if (!email || !password || !userId || !institutionName || !role || !status || !registrationDate || !positionType || !location) {
        return res.status(400).send({ message: 'All fields are required for city council registration.' });
    }

    try {
        // Cria o utilizador na autenticação Firebase
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Guarda os dados no Firestore com status "pending"
        await addDoc(UserCollection, {
            email,
            userId,
            institutionName,
            role,
            status,
            registrationDate,
            positionType,
            location
        });

        res.status(201).json({
            message: 'City council user registered and pending approval.',
            user: {
                email,
                userId,
                institutionName,
                role,
                status,
                registrationDate,
                positionType,
                location
            }
        });
    } catch (error) {
        console.error('Error creating pending user:', error.message);
        res.status(500).json({ message: 'Pending sign-up failed: ' + error.message });
    }
});

//------------------------------- Create Admin Profile --------------------------------
app.post('/createAdminProfile', async (req, res) => {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
        return res.status(400).json({ message: 'Email, password e nome são obrigatórios' });
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        const adminData = {
            email,
            name,
            userId: 'admin-' + Date.now(),
            role: 'admin'
        };

        await addDoc(UserCollection, adminData);

        console.log(`Admin account created: ${email}`);
        res.status(201).json({
            message: 'Admin profile created successfully',
            user: adminData
        });
    } catch (error) {
        console.error('Error creating admin profile:', error.message);
        res.status(500).json({ message: 'Failed to create admin profile: ' + error.message });
    }
});


//------------------------------- Log out --------------------------------
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
            return res.status(500).send({ message: 'Failed to destroy session' });
        }
        res.clearCookie('connect.sid'); // Clear the session cookie
        res.status(200).send({ message: 'Logged out successfully' });
        console.log('User logged out');
    });
});

//------------------------------- Get all users --------------------------------
app.get('/allUsers', async (req, res) => {
    try {
        const snapshot = await getDocs(UserCollection);
        const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log('Fetched all users.');
        res.status(200).json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});
//------------------------------- Delete User --------------------------------
app.post('/deleteUser', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email is required.' });
    }

    try {
        const q = query(UserCollection, where('email', '==', email));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return res.status(404).json({ error: 'User not found.' });
        }

        await deleteDoc(snapshot.docs[0].ref);
        console.log(`User deleted: ${email}`);
        res.status(200).json({ message: 'User deleted successfully.' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Failed to delete user.' });
    }
});

//------------------------------- Markers  and IDs --------------------------------

app.get('/markers', async (req, res) => {
    try {
        const snapshot = await getDocs(WalkwayCollection);
        const locations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.send(locations);
    } catch (error) {
        console.error('Error fetching locations:', error);
        res.status(500).json({ error: 'Error fetching locations' });
    }
});

//------------------------------- Profile Data --------------------------------
app.post('/profileData', async (req, res) => {
    //console.log('Profile data requested:', req.session.user);
    try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', userData.email)); 
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const userData = querySnapshot.docs[0].data();
            res.status(200).json(userData);
        } else {
            res.status(404).json({ error: 'User not found' });
        }
        //console.log('Profile data fetched:', userData.email);
    } catch (error) {
        console.error('Error fetching profile data:', error);
        res.status(500).json({ error: 'Error fetching profile data' });
    }
});
//------------------------------- Update Profile --------------------------------
app.post('/updateProfile', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email is required to identify the user.' });
    }

    try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', email)); // Using the 'email' from req.body
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const docRef = querySnapshot.docs[0].ref;

            // Create an object with only the fields provided in the request body
            const updateData = {};
            const allowedFields = ['userId', 'name', 'role', 'birthdate', 'height', 'weight', 'interests', 'bio'];
            
            allowedFields.forEach(field => {
                if (req.body[field] !== undefined) {
                    updateData[field] = req.body[field];
                }
            });

            // Update the profile with only the fields present in updateData
            await updateDoc(docRef, updateData);
            res.status(200).json({ message: 'Profile updated' });
            console.log('Profile updated for user:', email);
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ error: 'Error updating profile' });
    }
});

//------------------------------- add location to favorites --------------------------------
app.post('/addFavorite', async (req, res) => {
    const { locationId } = req.body; 
    const email = req.session.user?.email || userData.email;

    if (!email) {
        return res.status(401).json({ error: 'User is not authenticated' });
    }

    try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', email));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            return res.status(404).json({ error: 'User not found' });
        }

        const userDoc = querySnapshot.docs[0];
        const userDocRef = userDoc.ref;
        const userData = userDoc.data();
        const favorites = userData.favorites || [];

        const locationQuery = query(collection(db, 'walkways'), where('id', '==', locationId));
        const locationSnapshot = await getDocs(locationQuery);

        if (locationSnapshot.empty) {
            return res.status(404).json({ error: 'Location not found' });
        }

        const locationDocId = locationSnapshot.docs[0].id;

        if (favorites.includes(locationDocId)) {
            return res.status(400).json({ error: 'Location already in favorites' });
        }

        favorites.push(locationDocId);

        // Atribuir pontos (ex: 20 pontos)
        const currentPoints = userData.points || 0;
        const updatedPoints = currentPoints + 20;

        await updateDoc(userDocRef, { 
            favorites,
            points: updatedPoints
        });

        res.status(200).json({ message: 'Location added to favorites and points awarded' });
        console.log(`⭐ ${email} adicionou ${locationDocId} aos favoritos (+20 pontos)`);

    } catch (error) {
        console.error('Error adding location to favorites:', error);
        res.status(500).json({ error: 'Error adding location to favorites' });
    }
});

//----------------------------- remove location from favorites -----------------------------
app.post('/removeFavorite', async (req, res) => {
    const { locationId } = req.body;
    const email = req.session.user?.email || userData.email;

    if (!email) {
        return res.status(401).json({ error: 'User is not authenticated' });
    }

    try {
        // Get the user's document reference by querying the collection with the email
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', email)); // Query to find user document
        const querySnapshot = await getDocs(q);

        // Check if the user document exists
        if (querySnapshot.empty) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get the first matching document reference
        const userDocRef = querySnapshot.docs[0].ref;

        // Get current favorites or initialize an empty array
        const userData = querySnapshot.docs[0].data();
        const favorites = userData.favorites || [];

        // Query the 'walkways' collection to find a document where the 'id' field matches the locationId
        const locationQuery = query(collection(db, 'walkways'), where('id', '==', locationId));
        const locationSnapshot = await getDocs(locationQuery);

        // If the location does not exist, return an error
        if (locationSnapshot.empty) {
            return res.status(404).json({ error: 'Location not found' });
        }

        // Get the Firestore document ID of the first matched location
        const locationDocId = locationSnapshot.docs[0].id;

        // Check if the location is already in favorites (comparing Firestore document IDs, not the `id` field)
        if (!favorites.includes(locationDocId)) {
            return res.status(400).json({ error: 'Location not in favorites' });
        }

        // Remove the Firestore document ID of the location from the favorites array
        const updatedFavorites = favorites.filter(id => id !== locationDocId);

        // Update the user's favorites array in Firestore
        await updateDoc(userDocRef, { favorites: updatedFavorites });

        res.status(200).json({ message: 'Location removed from favorites' });
        console.log('Location removed from favorites:', locationDocId);

    } catch (error) {
        console.error('Error removing location from favorites:', error);
        res.status(500).json({ error: 'Error removing location from favorites' });
    }
});


//------------------------------- get all favorite locations --------------------------------
app.get('/favorites', async (req, res) => {
    // Prioritize session data over global userData
    const email = req.session.user?.email || userData.email;

    if (!email) {
        return res.status(401).json({ error: 'User is not authenticated' });
    }

    try {
        // Query the user's document using their email
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', email));
        const querySnapshot = await getDocs(q);

        // Check if the user document exists
        if (querySnapshot.empty) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get user data and favorites
        const userData = querySnapshot.docs[0].data();
        const favorites = userData.favorites || [];

        // If no favorites exist, return an empty array
        if (favorites.length === 0) {
            return res.status(200).json({ message: 'No favorites found', favorites: [] });
        }

        // Fetch each favorite location by its document ID
        const locations = [];
        for (const locationId of favorites) {
            try {
                // Get the location document by its Firestore document ID
                const locationDoc = await getDoc(doc(WalkwayCollection, locationId));

                if (locationDoc.exists()) {
                    locations.push({ id: locationDoc.id, ...locationDoc.data() });
                } else {
                    console.warn(`Location with ID ${locationId} not found.`);
                }
            } catch (err) {
                console.error(`Error fetching location with ID ${locationId}:`, err);
            }
        }

        // Return the list of favorite locations
        res.status(200).json({ favorites: locations });
        //console.log('Favorites with location details fetched:', locations);
    } catch (error) {
        console.error('Error fetching favorites:', error);
        res.status(500).json({ error: 'Error fetching favorites' });
    }
});


//------------------------------- add location and date to history --------------------------------
app.post('/addHistory', async (req, res) => {
    const { locationId, startDate } = req.body; // Ensure `startDate` is included in the request body
    const email = req.session.user?.email || userData.email;

    if (!email) {
        return res.status(401).json({ error: 'User is not authenticated' });
    }

    try {
        // Get the user's document reference by querying the collection with the email
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', email)); // Query to find user document
        const querySnapshot = await getDocs(q);

        // Check if the user document exists
        if (querySnapshot.empty) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get the first matching document reference
        const userDocRef = querySnapshot.docs[0].ref;

        // Get current history or initialize an empty array
        const userData = querySnapshot.docs[0].data();
        const history = userData.history || [];

        // Query the 'walkways' collection to find a document where the 'id' field matches the locationId
        const locationQuery = query(collection(db, 'walkways'), where('id', '==', locationId));
        const locationSnapshot = await getDocs(locationQuery);

        // If the location does not exist, return an error
        if (locationSnapshot.empty) {
            return res.status(404).json({ error: 'Location not found' });
        }

        // Get the Firestore document ID of the first matched location
        const locationDocId = locationSnapshot.docs[0].id;

        // Add the Firestore document ID of the location and the start date to the history array
        // Allow multiple entries for the same location with different start dates
        history.push({ locationId: locationDocId, startDate });

        // Update the user's history array in Firestore
        await updateDoc(userDocRef, { history });

        res.status(200).json({ message: 'Location added to history' });
        console.log('Location added to history:', locationDocId);

    } catch (error) {
        console.error('Error adding location to history:', error);
        res.status(500).json({ error: 'Error adding location to history' });
    }
});


//------------------------------- get all history locations --------------------------------
app.get('/history', async (req, res) => {
    const email = req.session.user?.email || userData.email;

    if (!email) {
        return res.status(401).json({ error: 'User is not authenticated' });
    }

    try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', email));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            return res.status(404).json({ error: 'User not found' });
        }

        const userData = querySnapshot.docs[0].data();
        const history = userData.history || [];

        if (history.length === 0) {
            return res.status(200).json({ message: 'No history found', history: [] });
        }

        // Buscar todos os walkways e criar um mapa: { walkwayId (número): { docId, ...data } }
        const walkwaysSnapshot = await getDocs(WalkwayCollection);
        const walkwayMap = {};
        walkwaysSnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.id !== undefined) {
                walkwayMap[data.id] = { id: doc.id, ...data };
            }
        });

        // Combinar info do histórico com dados dos passadiços
        const locations = history.map(entry => {
            const walkway = walkwayMap[entry.walkwayId];
            if (!walkway) {
                console.warn(`Walkway with ID ${entry.walkwayId} not found.`);
                return null;
            }
            return { ...walkway, ...entry };
        }).filter(Boolean); // remove entradas nulas

        res.status(200).json({ history: locations });
    } catch (error) {
        console.error('Error fetching history:', error);
        res.status(500).json({ error: 'Error fetching history' });
    }
});

//------------------------------- remove location from history --------------------------------
app.post('/removeHistory', async (req, res) => {
    const { locationId } = req.body;
    const email = req.session.user?.email || userData.email;

    if (!email) {
        return res.status(401).json({ error: 'User is not authenticated' });
    }

    try {
        // Get the user's document reference by querying the collection with the email
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', email)); // Query to find user document
        const querySnapshot = await getDocs(q);

        // Check if the user document exists
        if (querySnapshot.empty) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get the first matching document reference
        const userDocRef = querySnapshot.docs[0].ref;

        // Get current history or initialize an empty array
        const userData = querySnapshot.docs[0].data();
        const history = userData.history || [];

        // Query the 'walkways' collection to find a document where the 'id' field matches the locationId
        const locationQuery = query(collection(db, 'walkways'), where('id', '==', locationId));
        const locationSnapshot = await getDocs(locationQuery);

        // If the location does not exist, return an error
        if (locationSnapshot.empty) {
            return res.status(404).json({ error: 'Location not found' });
        }

        // Get the Firestore document ID of the first matched location
        const locationDocId = locationSnapshot.docs[0].id;

        // Check if the location is already in history (comparing Firestore document IDs, not the `id` field)
        if (!history.includes(locationDocId)) {
            return res.status(400).json({ error: 'Location not in history' });
        }

        // Remove the Firestore document ID of the location from the history array
        const updatedHistory = history.filter(id => id !== locationDocId);

        // Update the user's history array in Firestore
        await updateDoc(userDocRef, { history: updatedHistory });

        res.status(200).json({ message: 'Location removed from history' });
        console.log('Location removed from history:', locationDocId);

    } catch (error) {
        console.error('Error removing location from history:', error);
        res.status(500).json({ error: 'Error removing location from history' });
    }
});
// ------------------------------- get all interests --------------------------------
app.get('/interests', async (req, res) => {
    try {
        const snapshot = await getDocs(InterestCollection);
        const interests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.send(interests);
    } catch (error) {
        console.error('Error fetching interests:', error);
        res.status(500).json({ error: 'Error fetching interests' });
    }
});

//------------------------------- change photo -----------------------------------
app.post('/changePhoto', async (req, res) => {
    const {avatarURL } = req.body; // Certifique-se de enviar o email e o avatarURL no body da requisição.
    const email = req.session.user?.email || userData.email;
    if (!email || !avatarURL) {
        return res.status(400).json({ error: 'Email and avatar URL are required' });
    }

    try {
        // Busque o documento do usuário no Firestore com base no email
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', email));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Pegue a referência do primeiro documento encontrado (usuário)
        const userDocRef = querySnapshot.docs[0].ref;

        // Atualize o campo avatarURL no documento do usuário
        await updateDoc(userDocRef, { avatarURL });

        res.status(200).json({ message: 'Photo updated successfully' });
        console.log('User photo updated for:', email);
    } catch (error) {
        console.error('Error updating photo:', error);
        res.status(500).json({ error: 'Error updating photo' });
    }
});

//------------------------------------------------------- Gamification Functions ------------------------------------------------------------
//------------------------------- award points for existing comments --------------------------------
app.post('/awardPointsForExistingComments', async (req, res) => {
    try {
      // 1. Mapa para contar comentários por utilizador
      const userCommentCounts = {};
  
      // 2. Vai buscar todos os passadiços
      const walkwaysSnapshot = await getDocs(WalkwayCollection);
      walkwaysSnapshot.forEach((doc) => {
        const data = doc.data();
        const comments = data.publicComments || [];
  
        comments.forEach(comment => {
          const userId = comment.user;
          if (userId) {
            userCommentCounts[userId] = (userCommentCounts[userId] || 0) + 1;
          }
        });
      });
  
      // 3. Vai buscar todos os utilizadores
      const usersSnapshot = await getDocs(UserCollection);
      let updatedCount = 0;
  
      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        const userId = userData.userId;
  
        if (userCommentCounts[userId]) {
          const numComments = userCommentCounts[userId];
          const additionalPoints = numComments * 30;
  
          const currentPoints = userData.points || 0;
          const newPoints = currentPoints + additionalPoints;
  
          await updateDoc(userDoc.ref, { points: newPoints });
          updatedCount++;
          console.log(`✔️ Pontos atualizados para ${userId}: +${additionalPoints} (Total: ${newPoints})`);
        }
      }
  
      res.status(200).json({ message: `Pontos atribuídos a ${updatedCount} utilizador(es).` });
    } catch (error) {
      console.error('Erro ao atribuir pontos:', error);
      res.status(500).json({ error: 'Erro ao atribuir pontos com base nos comentários existentes.' });
    }
  });
  
//------------------------------- add points to user --------------------------------
app.post('/addPoints', async (req, res) => {
    const { points } = req.body;
    const email = req.session.user?.email || userData.email;

    if (!email || !points) {
        return res.status(400).json({ error: 'Email and points are required' });
    }

    try {
        // Get the user's document reference by querying the collection with the email
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', email)); // Query to find user document
        const querySnapshot = await getDocs(q);

        // Check if the user document exists
        if (querySnapshot.empty) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get the first matching document reference
        const userDocRef = querySnapshot.docs[0].ref;

        // Get current points or initialize to 0
        const userData = querySnapshot.docs[0].data();
        const currentPoints = userData.points || 0;

        // Add the points to the current total
        const updatedPoints = currentPoints + points;

        // Update the user's points in Firestore
        await updateDoc(userDocRef, { points: updatedPoints });

        res.status(200).json({ message: 'Points added successfully' });
        console.log('Points added to user:', email);

    } catch (error) {
        console.error('Error adding points:', error);
        res.status(500).json({ error: 'Error adding points' });
    }
});

//------------------------------- get user points --------------------------------
app.get('/points', async (req, res) => {
    const email = req.session.user?.email || userData.email;

    if (!email) {
        return res.status(401).json({ error: 'User is not authenticated' });
    }

    try {
        // Query the user's document using their email
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', email));
        const querySnapshot = await getDocs(q);

        // Check if the user document exists
        if (querySnapshot.empty) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get user data and points
        const userData = querySnapshot.docs[0].data();
        const points = userData.points || 0;

        res.status(200).json({ points });
        //console.log('User points fetched:', points);
    } catch (error) {
        console.error('Error fetching points:', error);
        res.status(500).json({ error: 'Error fetching points' });
    }
});
//------------------------------- get user level --------------------------------
// level 1 -> "Beginner" -> 0-299 points
// level 2 -> "Intermediate" -> 300-999 points
// level 3 -> "Advanced" -> 1000-2999 points
// level 4 -> "Expert" -> 3000-9999 points
// level 5 -> "Supreme Explorer" -> 10000+ points
app.get('/level', async (req, res) => {
    const email = req.session.user?.email || userData.email;

    if (!email) {
        return res.status(401).json({ error: 'User is not authenticated' });
    }

    try {
        // Query the user's document using their email
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', email));
        const querySnapshot = await getDocs(q);

        // Check if the user document exists
        if (querySnapshot.empty) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get user data and points
        const userData = querySnapshot.docs[0].data();
        const points = userData.points || 0;

        // Determine the user's level based on the points
        let level;
        if (points < 300) {
            level = 'Beginner';
        } else if (points < 1000) {
            level = 'Intermediate';
        } else if (points < 3000) {
            level = 'Advanced';
        } else if (points < 10000) {
            level = 'Expert';
        } else {
            level = 'Supreme Explorer';
        }

        res.status(200).json({ level });
        //console.log('User level fetched:', level);
    } catch (error) {
        console.error('Error fetching level:', error);
        res.status(500).json({ error: 'Error fetching level' });
    }
});

//------------------------------- get user level by userId --------------------------------
app.get('/getLevelByEmail/:email', async (req, res) => {
    const email = req.params.email;

    try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', email));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return res.status(404).json({ error: 'User not found' });
        }

        const userData = snapshot.docs[0].data();
        const points = userData.points || 0;

        let level;
        if (points < 300) level = 'Beginner';
        else if (points < 1000) level = 'Intermediate';
        else if (points < 3000) level = 'Advanced';
        else if (points < 10000) level = 'Expert';
        else level = 'Supreme Explorer';

        return res.status(200).json({ level });
    } catch (err) {
        console.error('Error fetching level by email:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

  
//------------------------------- get user rank --------------------------------
app.get('/rank', async (req, res) => {
    const email = req.session.user?.email || userData.email;

    if (!email) {
        return res.status(401).json({ error: 'User is not authenticated' });
    }

    try {
        // Query the user's document using their email
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', email));
        const querySnapshot = await getDocs(q);

        // Check if the user document exists
        if (querySnapshot.empty) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get user data and points
        const userData = querySnapshot.docs[0].data();
        const points = userData.points || 0;

        // Query all users and sort them by points in descending order
        const allUsersSnapshot = await getDocs(usersRef);
        const allUsers = allUsersSnapshot.docs.map(doc => doc.data());
        allUsers.sort((a, b) => b.points - a.points);

        // Find the user's rank by comparing the points
        const userRank = allUsers.findIndex(user => user.email === email) + 1;

        res.status(200).json({ rank: userRank });
        //console.log('User rank fetched:', userRank);
    } catch (error) {
        console.error('Error fetching rank:', error);
        res.status(500).json({ error: 'Error fetching rank' });
    }
});


//------------------------------------------------------- CityCoucil Functions ------------------------------------------------------------
//------------------------------- add location to table --------------------------------
app.post('/addLocations', async (req, res) => {
    try {
        // Validate if markers is an array
        if (!Array.isArray(markers)) {
            return res.status(400).json({ message: 'Invalid data format. Markers should be an array.' });
        }

        // Add the data to the 'walkways' collection in Firestore
        const collectionRef = collection(db, 'walkways');

        // Loop through the markers array and add each marker to the Firestore collection
        for (const marker of markers) {
            await addDoc(collectionRef, marker);
        }

        // Send a success response
        res.status(200).json({ message: 'Markers successfully added to the walkways collection.' });
    } catch (error) {
        console.error('Error adding markers to walkways collection:', error);
        res.status(500).json({ message: 'Failed to add markers to the walkways collection.', error: error.message });
    }
});

//------------------------------- add location by json --------------------------------
app.post('/addLocationJSON', async (req, res) => {
    const { locationJSON } = req.body;
    try {
        // Add the data to the 'walkways' collection in Firestore
        const collectionRef = collection(db, 'walkways');

        // Add the location data to the Firestore collection
        await addDoc(collectionRef, locationJSON);
        res.status(200).json({ message: 'Location added to walkways collection.' });
    } catch (error) {
        console.error('Error adding location to walkways collection:', error);
        res.status(500).json({ message: 'Failed to add location to walkways collection.', error: error.message });
    }
});

//------------------------------- add walkway to table --------------------------------
//------------------------------- add walkway to collection --------------------------------
app.post('/addWalkway', upload.fields([{ name: 'geojson' }, { name: 'primaryImage' }]), async (req, res) => {
    try {
        // Extract the fields from FormData
        const {
            id,
            name,
            description,
            district,
            region,
            'coordinates[latitude]': latitude,
            'coordinates[longitude]': longitude,
            'specifics[difficulty]': difficulty,
            'specifics[distance]': distance,
            'specifics[maxHeight]': maxHeight,
            'specifics[minHeight]': minHeight,
            'trajectory[start][latitude]': startLatitude,
            'trajectory[start][longitude]': startLongitude,
            'trajectory[end][latitude]': endLatitude,
            'trajectory[end][longitude]': endLongitude
        } = req.body;

        // Ensure all required fields are present
        if (!id || !name || !description || !latitude || !longitude || !district || !region || !difficulty || !distance || !maxHeight || !minHeight || !startLatitude || !startLongitude || !endLatitude || !endLongitude) {
            return res.status(400).json({ message: 'All required fields must be provided.' });
        }

        // Process GeoJSON file if uploaded
        let geojsonUrl = null;
        if (req.files && req.files['geojson']) {
            const geojsonFile = req.files['geojson'][0];
            const geojsonRef = ref(storage, `geojson/${uuidv4()}_${geojsonFile.originalname}`);
            await uploadBytes(geojsonRef, geojsonFile.buffer);
            geojsonUrl = await getDownloadURL(geojsonRef);
        } else if (req.body.geojson) {
            geojsonUrl = req.body.geojson; // If geojson is sent as a string
        }

        // Process Primary Image if uploaded
        let primaryImageUrl = null;
        if (req.files && req.files['primaryImage']) {
            const primaryImageFile = req.files['primaryImage'][0];
            const imageRef = ref(storage, `images/${uuidv4()}_${primaryImageFile.originalname}`);
            await uploadBytes(imageRef, primaryImageFile.buffer);
            primaryImageUrl = await getDownloadURL(imageRef);
        } else if (req.body.primaryImage) {
            primaryImageUrl = req.body.primaryImage; // If primaryImage is a URL string
        }

        // Construct the walkway data object to store in Firestore
        const walkwayData = {
            id,
            name,
            description,
            coordinates: {
                latitude: parseFloat(latitude),
                longitude: parseFloat(longitude),
            },
            district,
            geojson: geojsonUrl,
            primaryImage: primaryImageUrl,
            region,
            specifics: {
                difficulty: parseInt(difficulty),
                distance: parseFloat(distance),
                maxHeight: parseFloat(maxHeight),
                minHeight: parseFloat(minHeight),
            },
            trajectory: {
                start: {
                    latitude: parseFloat(startLatitude),
                    longitude: parseFloat(startLongitude),
                },
                end: {
                    latitude: parseFloat(endLatitude),
                    longitude: parseFloat(endLongitude),
                },
                round: req.body['trajectory[round]'] === 'true', // Parse boolean value
            },
        };

        // Add walkway data to Firestore
        const collectionRef = collection(db, 'walkways');
        await addDoc(collectionRef, walkwayData);

        res.status(200).json({ message: 'Walkway successfully added to the collection.' });
    } catch (error) {
        console.error('Error adding walkway to the collection:', error);
        res.status(500).json({ message: 'Failed to add walkway to the collection.', error: error.message });
    }
});


//------------------------------- add geojson to specific walkway table --------------------------------
app.post('/addGeojson', async (req, res) => {
    const { walkwayId, geojson } = req.body;

    if (!walkwayId || !geojson) {
        return res.status(400).json({ message: 'Walkway ID and GeoJSON data are required.' });
    }

    try {
        // Referência ao documento do walkway específico na coleção
        const walkwayDoc = doc(WalkwayCollection, walkwayId);

        // Converte o objeto GeoJSON para uma string JSON
        const geojsonString = JSON.stringify(geojson);

        // Usa setDoc para substituir o documento com o novo geojson
        await setDoc(walkwayDoc, { geojson: geojsonString }, { merge: true });

        // Enviar resposta de sucesso
        res.status(200).json({ message: 'GeoJSON data added to walkway document.' });
    } catch (error) {
        console.error('Error adding GeoJSON to walkway document:', error);
        res.status(500).json({ message: 'Failed to add GeoJSON to walkway document.', error: error.message });
    }
});

//------------------------------- get geojson from specific walkway table --------------------------------
app.get('/getGeojson', async (req, res) => {
    const { walkwayId } = req.query; // Ensure it's req.query and not req.body

    if (!walkwayId) {
        return res.status(400).json({ message: 'Walkway ID is required.' });
    }

    try {
        // Query the 'walkways' collection to find a document where the 'id' field matches the walkwayId
        const walkwayQuery = query(collection(db, 'walkways'), where('id', '==', parseInt(walkwayId)));
        const walkwaySnapshot = await getDocs(walkwayQuery);

        // If no document is found, return an error
        if (walkwaySnapshot.empty) {
            return res.status(404).json({ message: 'Walkway not found.' });
        }

        // Retrieve the document data
        const walkwayDoc = walkwaySnapshot.docs[0]; // The first (and likely only) matching document
        const geojsonString = walkwayDoc.data().geojson; // Access the geojson field

        if (!geojsonString) {
            return res.status(404).json({ message: 'GeoJSON not found for this walkway.' });
        }

        // Parse the GeoJSON string back into an object
        const geojson = JSON.parse(geojsonString);

        // Send the GeoJSON back to the frontend
        res.status(200).json({ geojson });
    } catch (error) {
        console.error('Error fetching GeoJSON:', error);
        res.status(500).json({ message: 'Error fetching GeoJSON.', error: error.message });
    }
});

//------------------------------- add a picture to a specific walkway --------------------------------
app.post('/addPictureWalkway', async (req, res) => {
    const { walkwayId, pictureURL } = req.body;

    if (!walkwayId || !pictureURL) {
        return res.status(400).json({ message: 'Walkway ID and picture URL are required.' });
    }

    try {
        // Referência ao documento do walkway específico na coleção
        const walkwayDoc = doc(WalkwayCollection, walkwayId);

        // Verificar se a URL da imagem é válida
        if (!pictureURL.startsWith('http')) {
            return res.status(400).json({ message: 'Invalid picture URL.' });
        }

        // Adiciona a URL da imagem ao array de imagens
        await updateDoc(walkwayDoc, { pictures: arrayUnion(pictureURL) });

        // Enviar resposta de sucesso
        res.status(200).json({ message: 'Picture added to walkway document.' });
    } catch (error) {
        console.error('Error adding picture to walkway document:', error);
        res.status(500).json({ message: 'Failed to add picture to walkway document.', error: error.message });
    }
});

//------------------------------- get all walkways --------------------------------
app.get('/allWalkways', async (req, res) => {
    try {
        const snapshot = await getDocs(WalkwayCollection);
        const walkways = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log('Fetched all walkways.');
        res.status(200).json(walkways);
    } catch (error) {
        console.error('Error fetching all walkways:', error);
        res.status(500).json({ error: 'Failed to fetch walkways' });
    }
});

//------------------------------- delete walkway --------------------------------
app.post('/deleteWalkway', async (req, res) => {
    const { walkwayId } = req.body;

    if (!walkwayId) {
        return res.status(400).json({ error: 'Walkway ID is required.' });
    }

    try {
        const q = query(WalkwayCollection, where('id', '==', parseInt(walkwayId)));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return res.status(404).json({ error: 'Walkway not found.' });
        }

        await deleteDoc(snapshot.docs[0].ref);
        console.log(`Walkway deleted: ${walkwayId}`);
        res.status(200).json({ message: 'Walkway deleted successfully.' });
    } catch (error) {
        console.error('Error deleting walkway:', error);
        res.status(500).json({ error: 'Failed to delete walkway.' });
    }
});

//------------------------------- Add Walkway To My List of Created Walkways --------------------------------

app.post('/addWalkwayToMyList', async (req, res) => {
    const { walkwayId } = req.body;
    const email = req.session.user?.email || userData.email;

    if (!email || !walkwayId) {
        return res.status(400).json({ error: 'Email and walkway ID are required' });
    }

    try {
        // Get the user's document reference by querying the collection with the email
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', email)); // Query to find user document
        const querySnapshot = await getDocs(q);

        // Check if the user document exists
        if (querySnapshot.empty) {
            return res.status(404).json({ error: 'User not found' });
        }
        // Get the first matching document reference
        const userDocRef = querySnapshot.docs[0].ref;

        // Get current createdWalkways or initialize an empty array
        const userData = querySnapshot.docs[0].data();
        const createdWalkways = userData.createdWalkways || [];

        // Check if the walkway is already in createdWalkways
        if (createdWalkways.includes(walkwayId)) {
            return res.status(400).json({ error: 'Walkway already in your list' });
        }

        // Add the walkway ID to the createdWalkways array
        createdWalkways.push(walkwayId);

        // Update the user's createdWalkways array in Firestore
        await updateDoc(userDocRef, { createdWalkways });

        res.status(200).json({ message: 'Walkway added to your list' });
        console.log('Walkway added to user list:', walkwayId);

    } catch (error) {
        console.error('Error adding walkway to user list:', error);
        res.status(500).json({ error: 'Error adding walkway to user list' });
    }
});

//------------------------------- Get my list of walkways --------------------------------
app.get('/myWalkways', async (req, res) => {
    const email = req.session.user?.email || userData.email;

    if (!email) {
        return res.status(401).json({ error: 'User is not authenticated' });
    }

    try {
        // Query the user's document using their email
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', email));
        const querySnapshot = await getDocs(q);

        // Check if the user document exists
        if (querySnapshot.empty) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get user data and createdWalkways
        const userData = querySnapshot.docs[0].data();
        const createdWalkways = userData.createdWalkways || [];

        // If no walkways exist, return an empty array
        if (createdWalkways.length === 0) {
            return res.status(200).json({ message: 'No walkways found', walkways: [] });
        }

        // Fetch each walkway by its document ID
        const walkways = [];
        for (const walkwayId of createdWalkways) {
            try {
                // Get the walkway document by its Firestore document ID
                const walkwayDoc = await getDoc(doc(WalkwayCollection, walkwayId));

                if (walkwayDoc.exists()) {
                    walkways.push({ id: walkwayDoc.id, ...walkwayDoc.data() });
                } else {
                    console.warn(`Walkway with ID ${walkwayId} not found.`);
                }
            } catch (err) {
                console.error(`Error fetching walkway with ID ${walkwayId}:`, err);
            }
        }

        // Return the list of created walkways
        res.status(200).json({ walkways });
        //console.log('Created walkways fetched:', walkways);
    } catch (error) {
        console.error('Error fetching created walkways:', error);
        res.status(500).json({ error: 'Error fetching created walkways' });
    }
});
//------------------------------- Remove Walkway From all Walkways ------------------------------
app.post('/removeWalkway', async (req, res) => {
    const { locationId } = req.body;
    const email = req.session.user?.email || userData.email;

    if (!email) {
        return res.status(401).json({ error: 'Staff is not authenticated' });
    }

    try {
        // Get the user's document reference by querying the collection with the email
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', email)); // Query to find user document
        const querySnapshot = await getDocs(q);

        // Check if the user document exists
        if (querySnapshot.empty) {
            return res.status(404).json({ error: 'Staff not found' });
        }

        // Get the first matching document reference
        const userDocRef = querySnapshot.docs[0].ref;

        // Get current createdWalkways or initialize an empty array
        const userData = querySnapshot.docs[0].data();
        const createdWalkways = userData.createdWalkways || [];

        // Query the 'walkways' collection to find a document where the 'id' field matches the locationId
        const locationQuery = query(collection(db, 'walkways'), where('id', '==', locationId));
        const locationSnapshot = await getDocs(locationQuery);

        // If the location does not exist, return an error
        if (locationSnapshot.empty) {
            return res.status(404).json({ error: 'Walkway not found' });
        }

        // Get the Firestore document ID of the first matched location
        const locationDocId = locationSnapshot.docs[0].id;

        // Check if the location is in the createdWalkways array
        if (!createdWalkways.includes(locationDocId)) {
            return res.status(400).json({ error: 'Walkway not in list' });
        }

        // Remove the Firestore document ID of the location from the createdWalkways array
        const updatedCreatedWalkways = createdWalkways.filter(id => id !== locationDocId);

        // Update the user's createdWalkways array in Firestore
        await updateDoc(userDocRef, { createdWalkways: updatedCreatedWalkways });

        // Remove the walkway document from the 'walkways' collection
        await deleteDoc(doc(db, 'walkways', locationDocId));

        res.status(200).json({ message: 'Walkway removed from list and deleted from the system' });
        console.log('Walkway removed from user list and deleted:', locationDocId);

    } catch (error) {
        console.error('Error removing walkway from the system:', error);
        res.status(500).json({ error: 'Error removing walkway from the system' });
    }
});

//------------------------------- Recommender Systems ---------------------------------
//------------------------------- add walkway history --------------------------------
app.post('/addWalkwayHistory', async (req, res) => {
    const {
        walkwayId,
        walkwayName,
        startDate,
        endDate,
        distanceCompleted,
        finished,
        timeSpent,
        experience
    } = req.body;

    const email = req.session.user?.email || userData.email;

    if (!email) {
        return res.status(401).json({ error: 'User is not authenticated' });
    }

    try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', email));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            return res.status(404).json({ error: 'User not found' });
        }

        const userDocRef = querySnapshot.docs[0].ref;
        const userData = querySnapshot.docs[0].data();
        const currentHistory = userData.history || [];
        let newPoints = userData.points || 0;
        let historyUpdated = false;
        let alreadyFinished = false;

        // Buscar o documento do passadiço correspondente ao walkwayId
        const walkwayQuery = query(collection(db, 'walkways'), where('id', '==', walkwayId));
        const walkwaySnapshot = await getDocs(walkwayQuery);

        if (walkwaySnapshot.empty) {
            return res.status(404).json({ error: 'Walkway not found' });
        }

        const walkwayDoc = walkwaySnapshot.docs[0];
        const difficulty = walkwayDoc.data()?.specifics?.difficulty || 1;

        const difficultyPoints = {
            1: 50,   // Fácil
            2: 100,  // Médio
            3: 200   // Difícil
        };

        const updatedHistory = currentHistory.map(entry => {
            if (entry.walkwayId === walkwayId) {
                alreadyFinished = entry.finished;
                historyUpdated = true;

                // Atribuir pontos apenas se for agora marcado como concluído
                if (!alreadyFinished && finished) {
                    newPoints += difficultyPoints[difficulty] || 50;
                }

                return {
                    ...entry,
                    startDate: startDate || entry.startDate,
                    endDate: endDate || entry.endDate,
                    distanceCompleted: distanceCompleted ?? entry.distanceCompleted,
                    finished: finished ?? entry.finished,
                    timeSpent: timeSpent ?? entry.timeSpent,
                    experience: experience ?? entry.experience
                };
            }
            return entry;
        });

        // Se for um novo histórico
        if (!historyUpdated) {
            updatedHistory.push({
                walkwayId,
                walkwayName,
                startDate,
                endDate,
                distanceCompleted,
                finished,
                timeSpent,
                experience
            });

            if (finished) {
                newPoints += difficultyPoints[difficulty] || 50;
            }
        }

        await updateDoc(userDocRef, {
            history: updatedHistory,
            points: newPoints
        });

        res.status(200).json({
            message: historyUpdated ? 'Walkway history updated' : 'Walkway history added successfully',
            pointsAwarded: finished ? difficultyPoints[difficulty] || 50 : 0
        });

        console.log(`✅ Histórico ${historyUpdated ? 'atualizado' : 'adicionado'} para ${email}. Pontos: +${finished ? (difficultyPoints[difficulty] || 50) : 0}`);

    } catch (error) {
        console.error('Erro ao atualizar/adicionar histórico do passadiço:', error);
        res.status(500).json({ error: 'Erro ao atualizar/adicionar histórico do passadiço' });
    }
});


//------------------------------- get walkway status --------------------------------
app.get('/walkwayStatus', async (req, res) => {
    const walkwayId = parseInt(req.query.walkwayId);
    const email = req.session.user?.email || userData.email;
  
    if (!email || isNaN(walkwayId)) {
      return res.status(400).json({ error: 'Email e walkway ID são obrigatórios.' });
    }
  
    try {
        // Obter doc do utilizador
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', email));
        const userSnapshot = await getDocs(q);
      
        if (userSnapshot.empty) {
          return res.status(404).json({ error: 'Utilizador não encontrado.' });
        }
      
        const userData = userSnapshot.docs[0].data();
        const history = userData.history || [];
      
        // Passo extra: obter Firestore walkwayId correspondente ao id numérico
        const walkwayQuery = query(collection(db, 'walkways'), where('id', '==', walkwayId));
        const walkwaySnapshot = await getDocs(walkwayQuery);
      
        if (walkwaySnapshot.empty) {
          return res.status(404).json({ error: 'Passadiço não encontrado.' });
        }
      
        const walkwayFirestoreId = walkwaySnapshot.docs[0].id;
      
        // Agora sim: procurar no histórico pelo Firestore walkwayId
        const entry = history.find(entry => entry.walkwayId === walkwayFirestoreId);
      
        if (!entry) {
          return res.json({ status: 'none' });
        }
      
        const status = entry.finished ? 'completed' : 'planned';
        const comment = entry.experience || null;
      
        res.json({ status, comment });
      } catch (err) {
        console.error('Erro ao verificar o estado do passadiço:', err);
        res.status(500).json({ error: 'Erro interno do servidor.' });
      }
      
  });

//------------------------------- get walkway comments --------------------------------
app.get('/getWalkwayComments', async (req, res) => {
    const { walkwayId } = req.query;
  
    if (!walkwayId) {
        return res.status(400).json({ error: 'walkwayId é obrigatório' });
    }

    try {
        // Usar o campo `id` (que é um número no Firestore) para encontrar o documento correto
        const q = query(WalkwayCollection, where('id', '==', parseInt(walkwayId)));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return res.status(404).json({ error: 'Walkway não encontrado' });
        }

        const docData = snapshot.docs[0].data();
        const comments = docData.publicComments || [];

        res.status(200).json({ comments });
        console.log(`✅ Comentários para walkway ${walkwayId}:`, comments);
    } catch (err) {
        console.error('❌ Erro ao obter comentários:', err);
        res.status(500).json({ error: 'Erro ao obter comentários' });
    }
});

  
//------------------------------- get walkway likes --------------------------------
app.get('/walkwayLikes', async (req, res) => {
    const { walkwayId } = req.query;
  
    if (!walkwayId) {
      return res.status(400).json({ error: 'walkwayId é obrigatório' });
    }
  
    try {
      // Primeiro, procurar o passadiço com o campo `id` igual ao walkwayId fornecido
      const walkwayQuery = query(WalkwayCollection, where('id', '==', parseInt(walkwayId)));
      const walkwaySnapshot = await getDocs(walkwayQuery);
  
      if (walkwaySnapshot.empty) {
        return res.status(404).json({ error: 'Passadiço não encontrado' });
      }
  
      // Obter o Firestore document ID do walkway (que é o que está guardado nos favoritos dos users)
      const walkwayDocId = walkwaySnapshot.docs[0].id;
  
      // Agora vamos contar quantos utilizadores têm este passadiço nos seus favoritos
      const usersSnapshot = await getDocs(collection(db, 'users'));
      let likeCount = 0;
  
      usersSnapshot.forEach((userDoc) => {
        const favorites = userDoc.data().favorites || [];
        if (favorites.includes(walkwayDocId)) {
          likeCount++;
        }
      });
  
      res.status(200).json({ likes: likeCount });
      console.log(`Walkway ${walkwayId} (docId: ${walkwayDocId}) tem ${likeCount} likes`);
    } catch (error) {
      console.error('Erro ao contar os likes do walkway:', error);
      res.status(500).json({ error: 'Erro interno ao contar os likes' });
    }
  });
  

  //------------------------------- get walkway comments --------------------------------
  app.get('/getWalkwayComments', async (req, res) => {
    const walkwayId = req.query.walkwayId;
    if (!walkwayId) {
      return res.status(400).json({ error: 'Walkway ID is required.' });
    }
  
    try {
      const q = query(collection(db, 'walkways'), where('id', '==', walkwayId));
      const snapshot = await getDocs(q);
  
      if (snapshot.empty) {
        return res.status(404).json({ error: 'Walkway not found.' });
      }
  
      const walkwayDoc = snapshot.docs[0];
      const comments = walkwayDoc.data().publicComments || [];
  
      // Get unique user UIDs from the comments
      const userUids = [...new Set(comments.map(comment => comment.user))];
  
      // Prepare nickname map
      const nicknames = {};
      const usersRef = collection(db, 'users');
  
      // Fetch userId (nickname) for each UID
      for (const uid of userUids) {
        const userSnap = await getDoc(doc(usersRef, uid));
        if (userSnap.exists()) {
          const data = userSnap.data();
          nicknames[uid] = data.userId || uid; // fallback to uid if userId not set
        } else {
          nicknames[uid] = uid;
        }
      }
  
      // Replace user UID with nickname
      const enrichedComments = comments.map(comment => ({
        ...comment,
        user: nicknames[comment.user] || comment.user,
      }));
  
      res.status(200).json({ comments: enrichedComments });
    } catch (error) {
      console.error("Error retrieving comments:", error);
      res.status(500).json({ error: "Error retrieving comments." });
    }
  });  
  
//------------------------------- add public comment --------------------------------
app.post('/addPublicComment', async (req, res) => {
    const { walkwayId, experience } = req.body;
    const email = req.session.user?.email || userData.email;
  
    if (!email || !walkwayId || !experience) {
      return res.status(400).json({ error: 'Email, walkway ID e experiência são obrigatórios.' });
    }
  
    try {
      // Obter o utilizador
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', email));
      const snapshot = await getDocs(q);
  
      if (snapshot.empty) {
        return res.status(404).json({ error: 'Utilizador não encontrado.' });
      }
  
      const userDoc = snapshot.docs[0];
      const userData = userDoc.data();
      const customUserId = userData.userId || userDoc.id;
  
      // Obter o walkway
      const walkwayQuery = query(collection(db, 'walkways'), where('id', '==', walkwayId));
      const walkwaySnap = await getDocs(walkwayQuery);
  
      if (walkwaySnap.empty) {
        return res.status(404).json({ error: 'Passadiço não encontrado.' });
      }
  
      const walkwayDoc = walkwaySnap.docs[0];
      const docRef = walkwayDoc.ref;
      const currentComments = walkwayDoc.data().publicComments || [];
  
      // Criar comentário
      const newComment = {
        user: customUserId,
        experience,
        timestamp: new Date().toISOString()
      };
  
      // Atualizar comentários públicos
      await updateDoc(docRef, {
        publicComments: [...currentComments, newComment]
      });
  
      // Atualizar pontos
      await updateDoc(userDoc.ref, {
        points: (userData.points || 0) + 30
      });
  
      // Atualizar experiência no histórico
      const history = userData.history || [];
      const updatedHistory = history.map(entry => {
        if (entry.walkwayId === walkwayId) {
          return { ...entry, experience };
        }
        return entry;
      });
  
      await updateDoc(userDoc.ref, {
        history: updatedHistory
      });
  
      res.status(200).json({ message: 'Comentário adicionado com sucesso e histórico atualizado.' });
      console.log(`🟢 Comentário e histórico atualizados para o passadiço ${walkwayId} por ${customUserId}`);
    } catch (error) {
      console.error('❌ Erro ao adicionar comentário público e atualizar histórico:', error);
      res.status(500).json({ error: 'Erro ao adicionar comentário público e atualizar histórico.' });
    }
  });
  
  
  
  
  
//------------------------------- migrate comments from history to public comments --------------------------------
app.post('/migrateComments', async (req, res) => {
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
  
      for (const userDoc of usersSnapshot.docs) {
        const userFirestoreId = userDoc.id;
        const userData = userDoc.data();
        const { history = [], userId } = userData;
  
        if (!userId) {
          console.warn(`Utilizador ${userFirestoreId} não tem campo userId`);
          continue;
        }
  
        for (const entry of history) {
          if (entry.finished && entry.experience) {
            const { walkwayId, experience, startDate } = entry;
  
            const walkwayRef = doc(db, 'walkways', walkwayId);
            const walkwayDoc = await getDoc(walkwayRef);
  
            if (walkwayDoc.exists()) {
              const currentComments = walkwayDoc.data().publicComments || [];
  
              const newComment = {
                user: userId, // aqui usamos o userId correto
                experience,
                timestamp: startDate || new Date().toISOString(),
              };
  
              await updateDoc(walkwayRef, {
                publicComments: [...currentComments, newComment],
              });
  
              console.log(`Comentário migrado de ${userId} para walkway ${walkwayId}`);
            } else {
              console.warn(`Walkway com id ${walkwayId} não encontrado`);
            }
          }
        }
      }
  
      res.status(200).json({ message: 'Migração concluída com sucesso!' });
    } catch (error) {
      console.error("Erro ao migrar comentários:", error);
      res.status(500).json({ error: 'Erro ao migrar comentários.' });
    }
  });
  
//-------------------- Top walkways --------------------
app.get('/topWalkways', async (req, res) => {
    try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const walkwaysSnapshot = await getDocs(collection(db, 'walkways'));

        // Criar mapa: walkwayId numérico => doc.id
        const walkwayIdMap = {};
        walkwaysSnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.id !== undefined) {
                walkwayIdMap[data.id] = doc.id;
            }
        });

        const walkwayLikes = {};

        usersSnapshot.forEach((userDoc) => {
            const userData = userDoc.data();

            // Contar favoritos (já vêm como doc.id)
            (userData.favorites || []).forEach(docId => {
                walkwayLikes[docId] = (walkwayLikes[docId] || 0) + 1;
            });

            // Contar históricos (têm walkwayId numérico, vamos converter)
            (userData.history || []).forEach(entry => {
                const docId = walkwayIdMap[entry.walkwayId];
                if (docId) {
                    walkwayLikes[docId] = (walkwayLikes[docId] || 0) + 1;
                }
            });
        });

        // Ordenar e buscar os top 3
        const sortedWalkways = Object.entries(walkwayLikes)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([docId, count]) => ({ docId, count }));

        const topWalkways = sortedWalkways.map(({ docId, count }) => {
            const doc = walkwaysSnapshot.docs.find(d => d.id === docId);
            return doc ? { id: docId, ...doc.data(), count } : null;
        }).filter(Boolean);

        res.status(200).json({ topWalkways });
    } catch (error) {
        console.error('Error fetching top liked walkways:', error);
        res.status(500).json({ error: 'Error fetching top liked walkways' });
    }
});
//-------------------- Top liked walkways --------------------
app.get('/topLikedWalkways', async (req, res) => {
    try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const walkwaysSnapshot = await getDocs(collection(db, 'walkways'));

        const likeCounts = {};

        usersSnapshot.forEach((userDoc) => {
            const userData = userDoc.data();
            (userData.favorites || []).forEach(docId => {
                likeCounts[docId] = (likeCounts[docId] || 0) + 1;
            });
        });

        const sorted = Object.entries(likeCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4) // ← limit 4
            .map(([docId, count]) => {
                const doc = walkwaysSnapshot.docs.find(d => d.id === docId);
                return doc ? { id: docId, ...doc.data(), count } : null;
            })
            .filter(Boolean);
        
            console.log('Top liked walkways:', sorted.map(w => ({ id: w.id, count: w.count })));
        res.status(200).json({ topLikedWalkways: sorted });
    } catch (error) {
        console.error('Error fetching top liked walkways:', error);
        res.status(500).json({ error: 'Error fetching top liked walkways' });
    }
});



//-------------------- Top explored walkways --------------------
app.get('/topExploredWalkways', async (req, res) => {
    try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const walkwaysSnapshot = await getDocs(collection(db, 'walkways'));

        const walkwayIdMap = {};
        walkwaysSnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.id !== undefined) {
                walkwayIdMap[data.id] = doc.id;
            }
        });

        const historyCounts = {};

        usersSnapshot.forEach((userDoc) => {
            const userData = userDoc.data();
            (userData.history || []).forEach(entry => {
                const docId = walkwayIdMap[entry.walkwayId];
                if (docId) {
                    historyCounts[docId] = (historyCounts[docId] || 0) + 1;
                }
            });
        });

        const sorted = Object.entries(historyCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4) // ← limit 4
            .map(([docId, count]) => {
                const doc = walkwaysSnapshot.docs.find(d => d.id === docId);
                return doc ? { id: docId, ...doc.data(), count } : null;
            })
            .filter(Boolean);

        console.log('Top explored walkways:', sorted.map(w => ({ id: w.id, count: w.count })));
        res.status(200).json({ topExploredWalkways: sorted });
    } catch (error) {
        console.error('Error fetching top explored walkways:', error);
        res.status(500).json({ error: 'Error fetching top explored walkways' });
    }
});



//------------------------------------------------------- Recomender system Functions ------------------------------------------------------------
//-------------------------------- Collaborative Filtering --------------------------------
//--------------------------------- Jaccard Similarity --------------------------------
/**
 * 
 * @param {*} setA
 * @param {*} setB 
 * @returns {number} Jaccard Similarity between two sets
 */
function jaccardSimilarity(setA, setB) {
    const intersection = setA.filter(value => setB.includes(value)).length;
    const union = new Set([...setA, ...setB]).size;
    return union === 0 ? 0 : intersection / union;
}

//------------------------------- Find Similar Users --------------------------------
/**
 * Finds users with similar interests to the target user.
 * @param {string} email - The email of the target user.
 * @param {number} minSimilarity - The minimum similarity threshold (0 to 1).
 * @returns {Promise<Array>} - An array of similar users with their similarity score and interests.
 */
async function findSimilarUsers(email, minSimilarity = 0.3) {
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const walkwaysSnapshot = await getDocs(collection(db, 'walkways'));    
  
    const walkwayIdMap = {}; // Mapeia walkwayId (campo) => doc.id
    walkwaysSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.id !== undefined) {
        walkwayIdMap[data.id] = doc.id;
      }
    });
  
    const currentUserDoc = usersSnapshot.docs.find(doc => doc.data().email === email);
  
    if (!currentUserDoc) {
      throw new Error('Utilizador não encontrado com esse email.');
    }
  
    const currentUser = currentUserDoc.data();
    const targetInterests = currentUser.interests || [];
  
    return usersSnapshot.docs
      .filter(doc => doc.data().email !== email && doc.data().interests)
      .map(doc => {
        const user = doc.data();
        const similarity = jaccardSimilarity(targetInterests, user.interests);
        
        if (similarity >= minSimilarity) {
          // Corrigir os walkwayId do histórico e favoritos para usarem doc.id
          const fixedHistory = (user.history || []).map(entry => ({
            ...entry,
            walkwayDocId: walkwayIdMap[entry.walkwayId] || entry.walkwayId
          }));
  
          const fixedFavorites = (user.favorites || []).map(fav =>
            walkwayIdMap[fav] || fav
          );
  
          return {
            email: user.email,
            similarity,
            history: fixedHistory,
            favorites: fixedFavorites
          };
        }
        return null;
      })
      .filter(Boolean);
  }
  
//------------------------------- Recommend Walkways --------------------------------
/**
 * Recommends walkways based on the user's history and similar users' interests.
 * @param {string} email - The email of the target user.
 * @param {number} minSimilarity - The minimum similarity threshold (0 to 1).
 * @returns {Promise<Array>} - An array of recommended walkways.
 */
async function recommendWalkways(email, minSimilarity = 0.3) {
    console.log(`Recommending walkways for user with email: ${email} and minimum similarity: ${minSimilarity}`);
    const similarUsers = await findSimilarUsers(email, minSimilarity);
    console.log(`Similar users found:`, similarUsers);

    const usersSnapshot = await getDocs(UserCollection);
    const targetUserDoc = usersSnapshot.docs.find(doc => doc.data().email === email);

    if (!targetUserDoc) {
        console.error("User not found");
        throw new Error("User not found");
    }

    const targetUser = targetUserDoc.data();
    const targetWalkways = new Set((targetUser.history || []).map(entry => entry.walkwayId));
    const targetFavorites = new Set(targetUser.favorites.map(fav => fav.toString()));
    console.log(`Target user's history and favorites loaded.`);

    const recommendedWalkways = new Set();

    similarUsers.forEach(user => {
        const userDoc = usersSnapshot.docs.find(doc => doc.data().email === user.email);
        const userData = userDoc.data();
        const userWalkways = userData.history || [];
        const userFavorites = userData.favorites || [];

        userWalkways.forEach(walkway => {
            if (!targetWalkways.has(walkway.walkwayId)) {
                console.log(`Adding recommended walkway ${walkway.walkwayId}`);
                recommendedWalkways.add(walkway.walkwayId);
            }
        });
        userFavorites.forEach(fav => {
            const favId = fav.toString(); // Ensure the ID is consistent
            if (!targetWalkways.has(favId) && !targetFavorites.has(favId)) {
                console.log(`Adding recommended favorite ${favId}`);
                recommendedWalkways.add(favId);
            }
        });
    });

    console.log(`Recommended walkways:`, Array.from(recommendedWalkways));

    // Fetch all walkways in one call
    const walkwayCollectionRef = collection(db, 'walkways');
    const walkwaysSnapshot = await getDocs(walkwayCollectionRef);
    //console.log(`All walkways in collection:`, walkwaysSnapshot.docs.map(doc => ({ id: doc.id, walkwayId: doc.data().id })));

    // find recommended walkways by comparing each document's walkwayId to recommendedWalkways
    const walkways = walkwaysSnapshot.docs
        .filter(doc => recommendedWalkways.has(doc.id)) 
        .map(doc => ({ id: doc.id, ...doc.data() }));
    
    //console.log(`Recommended walkways found:`, walkways);

    return walkways;
}

//------------------------------- Routes --------------------------------

// Endpoint para recomendar walkways
app.get('/recommenderCollaborative', async (req, res) => {
    const email = req.session.user?.email || userData.email;
    const minSimilarity = req.query.minSimilarity ? parseFloat(req.query.minSimilarity) : 0.3;

    if (!email) {
        return res.status(401).json({ error: 'User is not authenticated' });
    }

    try {
        const recommendations = await recommendWalkways(email, minSimilarity);
        res.status(200).json({ recommendations });
    } catch (error) {
        console.error('Error recommending walkways:', error);
        res.status(500).json({ error: 'Error recommending walkways' });
    }
});


//------------------------------- Find Similar Users (GET) --------------------------------
app.get('/similarUsers', async (req, res) => {
    const email = req.query.email || req.session.user?.email || userData.email;
    const minSimilarity = parseFloat(req.query.minSimilarity) || 0.3;

    if (!email) {
        return res.status(400).json({ error: 'Email é obrigatório para encontrar utilizadores semelhantes.' });
    }

    try {
        const similarUsers = await findSimilarUsers(email, minSimilarity);
        res.status(200).json({ similarUsers });
        console.log(`🔍 Utilizadores semelhantes encontrados para ${email}:`, similarUsers.length);
    } catch (error) {
        console.error('❌ Erro ao encontrar utilizadores semelhantes:', error);
        res.status(500).json({ error: 'Erro ao encontrar utilizadores semelhantes.' });
    }
});



//------------------------------- Content based Filtering --------------------------------
//------------------------------- Parse Distance --------------------------------
const parseDistance = (distanceStr) => {
    if (typeof distanceStr === 'string') {
      const match = distanceStr.match(/[\d.]+/); // extrai número
      return match ? parseFloat(match[0]) : 0;
    }
    return typeof distanceStr === 'number' ? distanceStr : 0;
  };
  
//-------------------------------  Normalize Data --------------------------------
const normalize = (vector) => {
    const magnitude = Math.sqrt(vector.distance ** 2 + vector.difficulty ** 2);
    if (magnitude === 0) {
        return { distance: 0, difficulty: 0 }; // evita divisão por zero
    }
    return {
        distance: vector.distance / magnitude,
        difficulty: vector.difficulty / magnitude
    };
};

//------------------------------- Euclidean Distance --------------------------------
const euclideanDistance = (a, b) => {
    return Math.sqrt(
        (a.distance - b.distance) ** 2 +
        (a.difficulty - b.difficulty) ** 2
    );
};
//------------------------------- Haversine Distance --------------------------------
const haversine = (lat1, lon1, lat2, lon2) => {
    const toRad = deg => deg * Math.PI / 180;
    const R = 6371; // km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
};
//------------------------------- Recommend by Euclidean --------------------------------
const recommendByEuclidean = (explored, unexplored) => {
    const normExplored = explored.map(w => {
        const rawDistance = parseDistance(w.specifics.distance);
        const rawDifficulty = w.specifics.difficulty;

        console.log(`\n🧮 Raw values for "${w.name}": distance=${rawDistance}, difficulty=${rawDifficulty}`);

        const normalized = normalize({
            distance: rawDistance,
            difficulty: rawDifficulty
        });

        console.log(`📏 Normalized vector for "${w.name}":`, normalized);

        return {
            ...w,
            ...normalized
        };
    });

    return unexplored.map(w => {
        const norm = normalize({
            distance: parseDistance(w.specifics.distance),
            difficulty: w.specifics.difficulty
        });

        const distances = normExplored.map(e => {
            const dist = euclideanDistance(e, norm);
            console.log(`\n📐 Euclidean between "${w.name}" (ID: ${w.id}) and "${e.name}" (ID: ${e.id}): ${dist.toFixed(3)}`);
            return dist;
        });

        const minDist = Math.min(...distances);
        return { ...w, euclidean: minDist };
    });
};



//------------------------------- Check if Geo Dispersed --------------------------------
const isGeoDispersed = (explored) => {
    let maxHaversine = 0;
    for (let i = 0; i < explored.length; i++) {
        for (let j = i + 1; j < explored.length; j++) {
            const d = haversine(
                explored[i].coordinates.latitude, explored[i].coordinates.longitude,
                explored[j].coordinates.latitude, explored[j].coordinates.longitude
            );
            if (d > maxHaversine) maxHaversine = d;
        }
    }
    return maxHaversine > 100;
};
//------------------------------- Refine by Geolocation --------------------------------
const refineByGeolocation = (euclideanScores, explored) => {
    return euclideanScores.map(w => {
        const minHaversine = Math.min(...explored.map(e =>
            haversine(w.coordinates.latitude, w.coordinates.longitude, e.coordinates.latitude, e.coordinates.longitude)
        ));
        return { ...w, combinedScore: w.euclidean + minHaversine };
    }).sort((a, b) => a.combinedScore - b.combinedScore);
};

//-------------------------------  Recommendation Content Based --------------------------------
app.get('/recommendContentBased', async (req, res) => {
    try {
        const email = req.session.user?.email || userData.email;
        if (!email) return res.status(401).json({ error: 'User is not authenticated' });

        const snapshot = await getDocs(WalkwayCollection);
        const allWalkways = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', email));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) return res.status(404).json({ error: 'User not found' });

        const userDoc = querySnapshot.docs[0];
        const userData = userDoc.data();
        const history = userData.history || [];
        const favorites = userData.favorites || [];

        const exploredIds = new Set([...history.map(h => h.walkwayId), ...favorites]);
        const explored = allWalkways.filter(w => exploredIds.has(w.id));
        const unexplored = allWalkways.filter(w => !exploredIds.has(w.id));

        if (explored.length === 0) return res.json([]);

        const euclideanScores = recommendByEuclidean(explored, unexplored);
        const useGeo = !isGeoDispersed(explored);
        const recommended = useGeo
            ? refineByGeolocation(euclideanScores, explored)
            : euclideanScores.sort((a, b) => a.euclidean - b.euclidean);

        res.status(200).json(recommended.slice(0, 5));
    } catch (err) {
        console.error('Erro na recomendação híbrida:', err);
        res.status(500).json({ error: 'Erro interno no sistema de recomendação.' });
    }
});

//-------------------------------  Recommendation Hybrid --------------------------------
app.get('/recommendHybridCascade', async (req, res) => {
    try {
        const email = req.session.user?.email || userData.email;
        if (!email) {
            console.warn("❌ Email not found.");
            return res.status(401).json({ error: 'User is not authenticated' });
        }
        console.log(`\n🔍 Starting hybrid cascade recommendation for: ${email}`);

        const usersSnapshot = await getDocs(UserCollection);
        const targetUserDoc = usersSnapshot.docs.find(doc => doc.data().email === email);
        if (!targetUserDoc) {
            console.warn(`❌ User ${email} not found in Firestore.`);
            return res.status(404).json({ error: 'User not found' });
        }

        const targetUser = targetUserDoc.data();
        const targetInterests = targetUser.interests || [];
        const targetHistory = targetUser.history || [];
        const targetFavorites = targetUser.favorites || [];

        console.log(`\n🎯 User interests:`, targetInterests);

        const walkwaysSnapshot = await getDocs(WalkwayCollection);
        const walkwayIdMap = {};
        const firestoreIdToNumeric = {};
        walkwaysSnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.id !== undefined) {
                walkwayIdMap[data.id] = doc.id;
                firestoreIdToNumeric[doc.id] = data.id;
            }
        });

        const similarUsers = usersSnapshot.docs
            .map(doc => doc.data())
            .filter(user => user.email !== email && user.interests)
            .map(user => {
                const similarity = jaccardSimilarity(targetInterests, user.interests);
                return similarity >= 0.3 ? { ...user, similarity } : null;
            })
            .filter(Boolean)
            .sort((a, b) => b.similarity - a.similarity);

        console.log(`\n👥 Found ${similarUsers.length} similar users.`);
        console.log(`🔍 Similar users interests:`, similarUsers.map(u => ({ email: u.email, interests: u.interests })));
        
        console.log(`\n📜 User history (walkway IDs):`, targetHistory.map(h => firestoreIdToNumeric[h.walkwayId] ?? h.walkwayId));
        console.log(`⭐ User favorite (walkway IDs):`, targetFavorites.map(f => firestoreIdToNumeric[f] ?? f ?? f));
        
        similarUsers.forEach(user => {
            const userEmail = user.email;
            const userHistory = (user.history || []).map(h => firestoreIdToNumeric[walkwayIdMap[h.walkwayId] ?? h.walkwayId] ?? h.walkwayId);
            const userFavorites = (user.favorites || []).map(f => firestoreIdToNumeric[walkwayIdMap[f] ?? f] ?? f);
            console.log(`\n📖 ${userEmail} explored (history):`, userHistory);
            console.log(`💖 ${userEmail} favorites:`, userFavorites);
        });

        const targetExplored = new Set([
            ...targetHistory.map(h => walkwayIdMap[h.walkwayId] || h.walkwayId),
            ...targetFavorites.map(f => walkwayIdMap[f] || f)
        ]);

        const collaborativeRecommendations = new Set();
        similarUsers.forEach(user => {
            (user.history || []).forEach(entry => {
                const docId = walkwayIdMap[entry.walkwayId] || entry.walkwayId;
                if (!targetExplored.has(docId)) {
                    collaborativeRecommendations.add(docId);
                }
            });
            (user.favorites || []).forEach(fav => {
                const docId = walkwayIdMap[fav] || fav;
                if (!targetExplored.has(docId)) {
                    collaborativeRecommendations.add(docId);
                }
            });
        });

        const collaborativeDetails = [...collaborativeRecommendations].map(docId => {
            const doc = walkwaysSnapshot.docs.find(d => d.id === docId);
            const data = doc?.data();
            const numericId = firestoreIdToNumeric[docId];
            const name = data?.name || "Unknown";
            return `${name} (ID: ${numericId})`;
        });

        console.log(`\n📌 Collaborative recommendations:`, collaborativeDetails);

        const allWalkways = walkwaysSnapshot.docs.map(doc => {
            const data = doc.data();
            return { ...data, docId: doc.id };
        });
        const explored = allWalkways.filter(w => targetExplored.has(w.docId));
        const recommendedWalkways = allWalkways.filter(w => collaborativeRecommendations.has(w.docId));

        const euclideanScores = recommendByEuclidean(explored, recommendedWalkways);

        const useGeo = !isGeoDispersed(explored);
        console.log(`\n📍 Geo-based refinement ${useGeo ? "enabled" : "disabled"} (based on dispersion)`);

        let finalRecommendations = useGeo
            ? refineByGeolocation(euclideanScores, explored)
            : euclideanScores.sort((a, b) => a.euclidean - b.euclidean);

        if (finalRecommendations.length === 0) {
            console.warn("⚠️ No valid content-based recommendations. Returning collaborative only.");
            finalRecommendations = recommendedWalkways.slice(0, 4); // já é baseado em colaborativo
        }

        console.log(`\n✅ Final top 4 recommendations:`, finalRecommendations.slice(0, 4).map(w => `${w.name} (ID: ${w.id})`));

        res.status(200).json(finalRecommendations.slice(0, 4));
    } catch (err) {
        console.error('❌ Error in hybrid cascade recommendation:', err);
        res.status(500).json({ error: 'Internal server error in recommendation system.' });
    }
});


//------------------------------- Server --------------------------------
app.listen(8080, () => {
    console.log('Server is running on http://localhost:8080');
});
