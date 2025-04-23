const express = require('express');
const app = express.Router();
const cors = require('cors');
const cookieParser = require("cookie-parser");
const http = require('http');
const { UserCollection, auth, db, WalkwayCollection, InterestCollection, admin, storage } = require('../firebase-config');
const {sendSignInLinkToEmail, createUserWithEmailAndPassword } = require('firebase/auth');
const { ref, uploadBytes, getDownloadURL} = require("firebase/storage");
const { addDoc, getDocs, updateDoc, doc, collection, query, where , getDoc, setDoc, arrayUnion, deleteDoc} = require('firebase/firestore');
const { c, u } = require('tar');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid'); 
const upload = multer({ storage: multer.memoryStorage() });
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

//------------------------------- Update Profile CityCouncil--------------------------------
app.post('/updateCityCouncilProfile', async (req, res) => {
    try {
        const { email, userId, institutionName, role, registrationDate, positionType, location } = req.body;
        if (!email) return res.status(400).json({ error: 'Missing email.' });
        
        const userQuery = query(UserCollection, where('email', '==', email));
        const querySnapshot = await getDocs(userQuery);
        
        if (querySnapshot.empty) {
          return res.status(404).json({ error: 'User with given email not found.' });
        }
        const userDoc = querySnapshot.docs[0]; // Assume-se que o email é único
        const userRef = doc(UserCollection, userDoc.id);
  
        await updateDoc(userRef, {
            email,
            userId,
            institutionName,
            role,
            registrationDate,
            positionType,
            location 
        });
    
        res.status(200).json({ message: 'Walker profile updated successfully.' });
    } catch (error) {
        console.error('Error updating Walker profile:', error);
        res.status(500).json({ error: 'Failed to update Walker profile.' });
    }
});

  //------------------------------- Update Profile Walker--------------------------------
  app.post('/updateWalkerProfile', async (req, res) => {
    try {
        const { email, name, role, birthdate, height, weight, bio, selectedInterests } = req.body;

        if (!email) return res.status(400).json({ error: 'Missing email.' });
        
        const userQuery = query(UserCollection, where('email', '==', email));
        const querySnapshot = await getDocs(userQuery);
        
        if (querySnapshot.empty) {
          return res.status(404).json({ error: 'User with given email not found.' });
        }
        
        const userDoc = querySnapshot.docs[0]; 
        const userRef = doc(UserCollection, userDoc.id);
        
        const updates = {
          name,
          role,
          birthdate,
          height,
          weight,
          bio,
          interests: selectedInterests,
        };
        
        // Remover campos undefined
        Object.keys(updates).forEach((key) => {
          if (updates[key] === undefined) delete updates[key];
        });
        
        await updateDoc(userRef, updates);
        
        res.status(200).json({ message: 'Walker profile updated successfully.' });        
    } catch (error) {
      console.error('Error updating Walker profile:', error);
      res.status(500).json({ error: 'Failed to update Walker profile.' });
    }
  });
  
//------------------------------- Delete Account --------------------------------
app.post('/deleteAccount', async (req, res) => {
    const email = req.session.user?.email;

    if (!email) {
        return res.status(401).json({ error: 'User not authenticated.' });
    }

    try {
        const q = query(UserCollection, where('email', '==', email));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const userDoc = snapshot.docs[0];

        // Elimina do Firestore
        await deleteDoc(userDoc.ref);

        // Elimina da Auth via Admin SDK
        const userRecord = await admin.auth().getUserByEmail(email);
        await admin.auth().deleteUser(userRecord.uid);

        // Termina sessão
        req.session.destroy(() => {
            res.clearCookie('connect.sid');
            res.status(200).json({ message: 'Account deleted successfully.' });
        });

        console.log(` Account and Auth deleted: ${email}`);
    } catch (error) {
        console.error('Error deleting account:', error);
        res.status(500).json({ error: 'Failed to delete account.' });
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
app.post('/changePhoto', upload.single('avatar'), async (req, res) => {
    const email = req.session.user?.email || userData.email;

    if (!email) {
        return res.status(401).json({ error: 'User not authenticated.' });
    }

    if (!req.file) {
        return res.status(400).json({ error: 'No avatar file uploaded.' });
    }

    try {
        // Criação da referência no Firebase Storage
        const avatarFile = req.file;
        const avatarRef = ref(storage, `avatars/${uuidv4()}_${avatarFile.originalname}`);
        await uploadBytes(avatarRef, avatarFile.buffer);

        // URL pública da imagem
        const avatarURL = await getDownloadURL(avatarRef);

        // Buscar documento do utilizador
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', email));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const userDocRef = snapshot.docs[0].ref;

        // Atualizar campo avatarURL
        await updateDoc(userDocRef, { avatarURL });

        res.status(200).json({ message: 'Photo updated successfully', avatarURL });
        console.log(`📸 Avatar atualizado para ${email}`);
    } catch (error) {
        console.error('Erro ao atualizar a foto de perfil:', error);
        res.status(500).json({ error: 'Erro ao atualizar a foto de perfil.' });
    }
});

//-------------------------------------------------- Admin Routes ----------------------------------

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




module.exports = app;
