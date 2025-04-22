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


module.exports = app;
