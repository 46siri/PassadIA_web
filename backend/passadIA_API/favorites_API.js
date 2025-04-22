const express = require('express');
const app = express.Router();
const cors = require('cors');
const cookieParser = require("cookie-parser");
const http = require('http');
const { UserCollection, auth, db, WalkwayCollection, InterestCollection } = require('../firebase-config');
const {sendSignInLinkToEmail, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } = require('firebase/auth');
const { getStorage } = require("firebase/storage");
const { addDoc, getDocs, updateDoc, doc, collection, query, where , getDoc, setDoc, arrayUnion} = require('firebase/firestore');
const { c, u } = require('tar');
// get markers from walkways/marker.json
const markers = require('../walkways/markers.json');
const multer = require('multer');
const { ref, uploadBytes, getDownloadURL } = require('firebase/storage');
const { v4: uuidv4 } = require('uuid'); // For unique file names
const upload = multer({ storage: multer.memoryStorage() });
// create a global variable to store the user data
let userData = {};

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

module.exports = app;
