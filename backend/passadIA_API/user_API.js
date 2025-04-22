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

//------------------------------- Profile Data --------------------------------
//------------------------------- Profile Data --------------------------------
app.post('/profileData', async (req, res) => {
    const email = req.session.user?.email;
    
    if (!email) {
        return res.status(401).json({ error: 'User not authenticated.' });
    }

    try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', email)); 
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const userDoc = querySnapshot.docs[0];
            const userInfo = userDoc.data();
            res.status(200).json(userInfo);
        } else {
            res.status(404).json({ error: 'User not found' });
        }
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


module.exports = app;
