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
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', email));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            return res.status(404).json({ error: 'User not found' });
        }

        const userDocRef = querySnapshot.docs[0].ref;

        const userData = querySnapshot.docs[0].data();
        const favorites = userData.favorites || [];

        const locationQuery = query(collection(db, 'walkways'), where('id', '==', locationId));
        const locationSnapshot = await getDocs(locationQuery);

        if (locationSnapshot.empty) {
            return res.status(404).json({ error: 'Location not found' });
        }

        const locationDocId = locationSnapshot.docs[0].id;

        if (!favorites.includes(locationDocId)) {
            return res.status(400).json({ error: 'Location not in favorites' });
        }

        const updatedFavorites = favorites.filter(id => id !== locationDocId);

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
    const email = req.session.user?.email;

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
        const favorites = userData.favorites || [];

        if (favorites.length === 0) {
            return res.status(200).json({ message: 'No favorites found', favorites: [] });
        }

        const locations = [];
        for (const locationId of favorites) {
            try {
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

        res.status(200).json({ favorites: locations });
    } catch (error) {
        console.error('Error fetching favorites:', error);
        res.status(500).json({ error: 'Error fetching favorites' });
    }
});

module.exports = app;
