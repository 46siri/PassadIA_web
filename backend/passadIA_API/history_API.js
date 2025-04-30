const express = require('express');
const app = express.Router();
const cors = require('cors');
const cookieParser = require("cookie-parser");
const http = require('http');
const { UserCollection, auth, db, WalkwayCollection, InterestCollection } = require('../firebase-config');
const { getStorage } = require("firebase/storage");
const { addDoc, getDocs, updateDoc, doc, collection, query, where , getDoc, setDoc, arrayUnion} = require('firebase/firestore');
const { c, u } = require('tar');
const markers = require('../walkways/markers.json');
const multer = require('multer');
const { ref, uploadBytes, getDownloadURL } = require('firebase/storage');
const { v4: uuidv4 } = require('uuid'); 
const upload = multer({ storage: multer.memoryStorage() });
let userData = {};

//------------------------------- add location and date to history --------------------------------
app.post('/addHistory', async (req, res) => {
    const { locationId, startDate } = req.body; 
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
        const history = userData.history || [];

        const locationQuery = query(collection(db, 'walkways'), where('id', '==', locationId));
        const locationSnapshot = await getDocs(locationQuery);

        if (locationSnapshot.empty) {
            return res.status(404).json({ error: 'Location not found' });
        }

        const locationDocId = locationSnapshot.docs[0].id;

        history.push({ locationId: locationDocId, startDate });

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

        const walkwaysSnapshot = await getDocs(WalkwayCollection);
        const walkwayMap = {};
        walkwaysSnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.id !== undefined) {
                walkwayMap[data.id] = { id: doc.id, ...data };
            }
        });

        const locations = history.map(entry => {
            const walkway = walkwayMap[entry.walkwayId];
            if (!walkway) {
                console.warn(`Walkway with ID ${entry.walkwayId} not found.`);
                return null;
            }
            return { ...walkway, ...entry };
        }).filter(Boolean);

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
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', email)); 
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            return res.status(404).json({ error: 'User not found' });
        }

        const userDocRef = querySnapshot.docs[0].ref;

        const userData = querySnapshot.docs[0].data();
        const history = userData.history || [];

        const locationQuery = query(collection(db, 'walkways'), where('id', '==', locationId));
        const locationSnapshot = await getDocs(locationQuery);

        if (locationSnapshot.empty) {
            return res.status(404).json({ error: 'Location not found' });
        }

        const locationDocId = locationSnapshot.docs[0].id;

        if (!history.includes(locationDocId)) {
            return res.status(400).json({ error: 'Location not in history' });
        }

        const updatedHistory = history.filter(id => id !== locationDocId);

        await updateDoc(userDocRef, { history: updatedHistory });

        res.status(200).json({ message: 'Location removed from history' });
        console.log('Location removed from history:', locationDocId);

    } catch (error) {
        console.error('Error removing location from history:', error);
        res.status(500).json({ error: 'Error removing location from history' });
    }
});


module.exports = app;
