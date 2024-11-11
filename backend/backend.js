const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');
const cors = require('cors');
const cookieParser = require("cookie-parser");
const http = require('http');
const { UserCollection, auth, db, WalkwayCollection, InterestCollection } = require('./firebase-config');
const { createUserWithEmailAndPassword, signInWithEmailAndPassword } = require('firebase/auth');
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

//----------------------------- Password Reset -------------------------------
app.post("/resetPassword", async (req, res) => {
    const { email, password, id } = req.body;
    try {
        const userDocRef = doc(UserCollection, id);
        await updateDoc(userDocRef, { email, password });
        res.send("Password updated");
    } catch (error) {
        console.error("Error updating password:", error);
        res.status(500).send("Error updating password");
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

        req.session.user = { email: user.email, uid: user.uid }; 
        req.session.save((err) => {
            if (err) {
                return res.status(500).send({ message: 'Session save failed' });
            }
            res.status(200).send({ message: 'Login successful', user: { email: user.email, role: user.role } });
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
        if (favorites.includes(locationDocId)) {
            return res.status(400).json({ error: 'Location already in favorites' });
        }

        // Add the Firestore document ID of the location to the favorites array
        favorites.push(locationDocId);

        // Update the user's favorites array in Firestore
        await updateDoc(userDocRef, { favorites });

        res.status(200).json({ message: 'Location added to favorites' });
        console.log('Location added to favorites:', locationDocId);

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

        // Get user data and history
        const userData = querySnapshot.docs[0].data();
        const history = userData.history || [];

        // If no history exists, return an empty array
        if (history.length === 0) {
            return res.status(200).json({ message: 'No history found', history: [] });
        }

        // Fetch each history entry by its document ID and include the start date
        const locations = [];
        for (const entry of history) {
            const { locationId, startDate } = entry; // Ensure the history stores { locationId, startDate }

            try {
                // Get the location document by its Firestore document ID
                const locationDoc = await getDoc(doc(WalkwayCollection, locationId));

                if (locationDoc.exists()) {
                    // Include the location details and the associated start date in the response
                    locations.push({ id: locationDoc.id, startDate, ...locationDoc.data() });
                } else {
                    console.warn(`Location with ID ${locationId} not found.`);
                }
            } catch (err) {
                console.error(`Error fetching location with ID ${locationId}:`, err);
            }
        }

        // Return the list of history locations with start dates
        res.status(200).json({ history: locations });
        //console.log('History with location details and start dates fetched:', locations);
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

//------------------------------------------------------- Recomender system Functions ------------------------------------------------------------

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
//------------------------- automatize user data ----------------------
app.post('/addWalkwayHistory', async (req, res) => {
    const {
        userId,
        walkwayId,
        walkwayName,
        startDate,
        endDate,
        distanceCompleted,
        finished,
        timeSpent,
        experience
    } = req.body;

    try {
        const userDocRef = doc(db, 'users', userId);

        // Atualizar o histórico do utilizador com os dados fornecidos
        await updateDoc(userDocRef, {
            history: arrayUnion({
                walkwayId,
                walkwayName,
                startDate,
                endDate,
                distanceCompleted,
                finished,
                timeSpent,
                experience
            })
        });

        res.status(200).json({ message: 'Walkway history added successfully' });
        console.log('Walkway history added for user:', userId);

    } catch (error) {
        console.error('Error adding walkway history:', error);
        res.status(500).json({ error: 'Error adding walkway history' });
    }
});

//-------------------- Top liked walkways --------------------
app.get('/topLikedWalkways', async (req, res) => {
    try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const walkwayLikes = {};

        // Count likes from favorites and history for each walkway
        usersSnapshot.forEach((userDoc) => {
            const userData = userDoc.data();

            // Count favorites
            if (userData.favorites && Array.isArray(userData.favorites)) {
                userData.favorites.forEach((walkwayId) => {
                    if (walkwayLikes[walkwayId]) {
                        walkwayLikes[walkwayId]++;
                    } else {
                        walkwayLikes[walkwayId] = 1;
                    }
                });
            }

            // Count history entries
            if (userData.history && Array.isArray(userData.history)) {
                userData.history.forEach((historyEntry) => {
                    const walkwayId = historyEntry.walkwayId;
                    if (walkwayLikes[walkwayId]) {
                        walkwayLikes[walkwayId]++;
                    } else {
                        walkwayLikes[walkwayId] = 1;
                    }
                });
            }
        });

        // Convert walkwayLikes to an array and sort by popularity
        const sortedWalkways = Object.entries(walkwayLikes)
            .sort((a, b) => b[1] - a[1]) // Sort by count in descending order
            .slice(0, 3) // Get top 3 walkways
            .map(([walkwayId, count]) => ({ walkwayId, count }));

        // Fetch details of the top 3 walkways
        const walkwayCollectionRef = collection(db, 'walkways');
        const walkwaysSnapshot = await getDocs(walkwayCollectionRef);
        const topWalkways = sortedWalkways.map(({ walkwayId }) => {
            const walkwayDoc = walkwaysSnapshot.docs.find((doc) => doc.id === walkwayId);
            return walkwayDoc ? { id: walkwayId, ...walkwayDoc.data() } : null;
        }).filter((walkway) => walkway); // Remove null entries in case a walkwayId is not found

        res.status(200).json({ topWalkways });
    } catch (error) {
        console.error('Error fetching top liked walkways:', error);
        res.status(500).json({ error: 'Error fetching top liked walkways' });
    }
});


//------------------------------- Server --------------------------------
app.listen(8080, () => {
    console.log('Server is running on http://localhost:8080');
});
