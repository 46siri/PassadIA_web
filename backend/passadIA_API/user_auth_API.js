const express = require('express');
const app = express.Router();
const { UserCollection, db, auth } = require('../firebase-config');
const { sendPasswordResetEmail } = require('firebase/auth');
const { signInWithEmailAndPassword, createUserWithEmailAndPassword } = require('firebase/auth');
const { addDoc, getDocs, updateDoc, doc, collection, query, where , getDoc, setDoc, arrayUnion} = require('firebase/firestore');
const { getAuth } = require('firebase/auth');
const { initializeApp } = require('firebase/app');

//------------------------------- Sign up --------------------------------
app.post('/signup', async (req, res) => {
    const { email, password, name, birthdate, userId, role, interests } = req.body;

    if (!email || !password || !name || !birthdate || !userId || !role || !interests) {
        return res.status(400).send({ message: 'All fields are required' });
    }
    if (!Array.isArray(interests)) {
        return res.status(400).json({ message: 'Interests must be an array' });
    }
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await addDoc(UserCollection, { email, name, birthdate, userId, role, interests });

        res.status(201).json({ message: 'User created successfully', user: { email, name, birthdate, userId, role, interests } });
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

    if (!email || !password || !userId || !institutionName || !role || !status || !registrationDate || !positionType || !location) {
        return res.status(400).send({ message: 'All fields are required for city council registration.' });
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

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
//------------------------------- Sign in --------------------------------

app.post('/signin', async (req, res) => {
    const { email, password } = req.body;

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', email));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            return res.status(404).send({ message: 'User not found in Firestore.' });
        }

        const userDoc = querySnapshot.docs[0].data();

        if (userDoc.role === 'Staff' && userDoc.status === 'pending') {
            return res.status(403).send({ message: 'Your account has not yet been approved by the administration.' });
        }

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

//------------------------------- Log out --------------------------------
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
            return res.status(500).send({ message: 'Failed to destroy session' });
        }
        res.clearCookie('connect.sid'); 
        res.status(200).send({ message: 'Logged out successfully' });
        console.log('User logged out');
    });
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

module.exports = app;
