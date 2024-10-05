const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');
const cors = require('cors');
const cookieParser = require("cookie-parser");
const http = require('http');
const { UserCollection, auth, db, WalkwayCollection } = require('./firebase-config');
const { createUserWithEmailAndPassword, signInWithEmailAndPassword } = require('firebase/auth');
const { addDoc, getDocs, updateDoc, doc, collection, query, where , getDoc} = require('firebase/firestore');
const { c, u } = require('tar');

const app = express();
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
        //console.log('Session data:', req.session.user);
        req.session.save((err) => {
            if (err) {
                return res.status(500).send({ message: 'Session save failed' });
            }
            res.status(200).send({ message: 'Login successful' });
            userData = user;
            //console.log('User data saved:', userData);
        });
        console.log('User logged in:', user.email);
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).send({ message: 'Login failed' });
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
        console.log('Profile data fetched:', userData.email);
    } catch (error) {
        console.error('Error fetching profile data:', error);
        res.status(500).json({ error: 'Error fetching profile data' });
    }
});
//------------------------------- Update Profile --------------------------------

app.post('/updateProfile', async (req, res) => {
    const { email, userId, name, role, birthdate, height, weight, interests, bio } = req.body;

    try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', email)); // Using the 'email' from req.body
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const docRef = querySnapshot.docs[0].ref;
            // Update the profile fields (only the fields passed in the request)
            await updateDoc(docRef, { email, name, birthdate, role, height, weight, interests, bio });
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

        // Check if the location is already in history (comparing Firestore document IDs, not the `id` field)
        if (history.some(item => item.locationId === locationDocId)) {
            return res.status(400).json({ error: 'Location already in history' });
        }

        // Add the Firestore document ID of the location and the start date to the history array
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

//------------------------------- Server --------------------------------
app.listen(8080, () => {
    console.log('Server is running on http://localhost:8080');
});
