const { initializeApp } = require('firebase/app');
const { getFirestore, collection } = require('firebase/firestore');
const { getAuth } = require('firebase/auth'); // Import Firebase Authentication
const { getStorage } = require('firebase/storage'); // Import Firebase Storage
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

const firebaseConfig = {
  apiKey: "AIzaSyDGWw7a3DMovfffSzo3V09JUfm_da4jOnM",
  authDomain: "passadia-87c3c.firebaseapp.com",
  databaseURL: "https://passadia-87c3c-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "passadia-87c3c",
  storageBucket: "passadia-87c3c.appspot.com",
  messagingSenderId: "814947443055",
  appId: "1:814947443055:web:3ee68d22c8234bf777489a",
  measurementId: "G-95R0WWXTWL"
};

// Initialize Firebase app
const app = initializeApp(firebaseConfig);

// Initialize Firestore, Authentication, and Storage
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app); 

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://passadia-87c3c-default-rtdb.europe-west1.firebasedatabase.app"
});

// Reference to the Firestore collections
const UserCollection = collection(db, 'users');
const WalkwayCollection = collection(db, 'walkways');
const InterestCollection = collection(db, 'interests');

module.exports = { db, auth, storage, UserCollection, WalkwayCollection, InterestCollection, admin };
