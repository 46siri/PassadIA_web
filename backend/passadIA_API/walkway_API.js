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

//------------------------------- add walkway history --------------------------------
app.post('/addWalkwayHistory', async (req, res) => {
    const {
        walkwayId,
        walkwayName,
        startDate,
        endDate,
        distanceCompleted,
        finished,
        timeSpent,
        experience
    } = req.body;

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
        const currentHistory = userData.history || [];
        let newPoints = userData.points || 0;
        let historyUpdated = false;
        let alreadyFinished = false;

        // Buscar o documento do passadiço correspondente ao walkwayId
        const walkwayQuery = query(collection(db, 'walkways'), where('id', '==', walkwayId));
        const walkwaySnapshot = await getDocs(walkwayQuery);

        if (walkwaySnapshot.empty) {
            return res.status(404).json({ error: 'Walkway not found' });
        }

        const walkwayDoc = walkwaySnapshot.docs[0];
        const difficulty = walkwayDoc.data()?.specifics?.difficulty || 1;

        const difficultyPoints = {
            1: 50,   // Fácil
            2: 100,  // Médio
            3: 200   // Difícil
        };

        const updatedHistory = currentHistory.map(entry => {
            if (entry.walkwayId === walkwayId) {
                alreadyFinished = entry.finished;
                historyUpdated = true;

                // Atribuir pontos apenas se for agora marcado como concluído
                if (!alreadyFinished && finished) {
                    newPoints += difficultyPoints[difficulty] || 50;
                }

                return {
                    ...entry,
                    startDate: startDate || entry.startDate,
                    endDate: endDate || entry.endDate,
                    distanceCompleted: distanceCompleted ?? entry.distanceCompleted,
                    finished: finished ?? entry.finished,
                    timeSpent: timeSpent ?? entry.timeSpent,
                    experience: experience ?? entry.experience
                };
            }
            return entry;
        });

        // Se for um novo histórico
        if (!historyUpdated) {
            updatedHistory.push({
                walkwayId,
                walkwayName,
                startDate,
                endDate,
                distanceCompleted,
                finished,
                timeSpent,
                experience
            });

            if (finished) {
                newPoints += difficultyPoints[difficulty] || 50;
            }
        }

        await updateDoc(userDocRef, {
            history: updatedHistory,
            points: newPoints
        });

        res.status(200).json({
            message: historyUpdated ? 'Walkway history updated' : 'Walkway history added successfully',
            pointsAwarded: finished ? difficultyPoints[difficulty] || 50 : 0
        });

        console.log(`✅ Histórico ${historyUpdated ? 'atualizado' : 'adicionado'} para ${email}. Pontos: +${finished ? (difficultyPoints[difficulty] || 50) : 0}`);

    } catch (error) {
        console.error('Erro ao atualizar/adicionar histórico do passadiço:', error);
        res.status(500).json({ error: 'Erro ao atualizar/adicionar histórico do passadiço' });
    }
});


//------------------------------- get walkway status --------------------------------
app.get('/walkwayStatus', async (req, res) => {
    const walkwayId = parseInt(req.query.walkwayId);
    const email = req.session.user?.email || userData.email;
  
    if (!email || isNaN(walkwayId)) {
      return res.status(400).json({ error: 'Email e walkway ID são obrigatórios.' });
    }
  
    try {
        // Obter doc do utilizador
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', email));
        const userSnapshot = await getDocs(q);
      
        if (userSnapshot.empty) {
          return res.status(404).json({ error: 'Utilizador não encontrado.' });
        }
      
        const userData = userSnapshot.docs[0].data();
        const history = userData.history || [];
      
        // Passo extra: obter Firestore walkwayId correspondente ao id numérico
        const walkwayQuery = query(collection(db, 'walkways'), where('id', '==', walkwayId));
        const walkwaySnapshot = await getDocs(walkwayQuery);
      
        if (walkwaySnapshot.empty) {
          return res.status(404).json({ error: 'Passadiço não encontrado.' });
        }
      
        const walkwayFirestoreId = walkwaySnapshot.docs[0].id;
      
        // Agora sim: procurar no histórico pelo Firestore walkwayId
        const entry = history.find(entry => entry.walkwayId === walkwayFirestoreId);
      
        if (!entry) {
          return res.json({ status: 'none' });
        }
      
        const status = entry.finished ? 'completed' : 'planned';
        const comment = entry.experience || null;
      
        res.json({ status, comment });
      } catch (err) {
        console.error('Erro ao verificar o estado do passadiço:', err);
        res.status(500).json({ error: 'Erro interno do servidor.' });
      }
      
  });

//------------------------------- get walkway comments --------------------------------
app.get('/getWalkwayComments', async (req, res) => {
    const { walkwayId } = req.query;
  
    if (!walkwayId) {
        return res.status(400).json({ error: 'walkwayId é obrigatório' });
    }

    try {
        // Usar o campo `id` (que é um número no Firestore) para encontrar o documento correto
        const q = query(WalkwayCollection, where('id', '==', parseInt(walkwayId)));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return res.status(404).json({ error: 'Walkway não encontrado' });
        }

        const docData = snapshot.docs[0].data();
        const comments = docData.publicComments || [];

        res.status(200).json({ comments });
        console.log(`✅ Comentários para walkway ${walkwayId}:`, comments);
    } catch (err) {
        console.error('❌ Erro ao obter comentários:', err);
        res.status(500).json({ error: 'Erro ao obter comentários' });
    }
});

  
//------------------------------- get walkway likes --------------------------------
app.get('/walkwayLikes', async (req, res) => {
    const { walkwayId } = req.query;
  
    if (!walkwayId) {
      return res.status(400).json({ error: 'walkwayId é obrigatório' });
    }
  
    try {
      // Primeiro, procurar o passadiço com o campo `id` igual ao walkwayId fornecido
      const walkwayQuery = query(WalkwayCollection, where('id', '==', parseInt(walkwayId)));
      const walkwaySnapshot = await getDocs(walkwayQuery);
  
      if (walkwaySnapshot.empty) {
        return res.status(404).json({ error: 'Passadiço não encontrado' });
      }
  
      // Obter o Firestore document ID do walkway (que é o que está guardado nos favoritos dos users)
      const walkwayDocId = walkwaySnapshot.docs[0].id;
  
      // Agora vamos contar quantos utilizadores têm este passadiço nos seus favoritos
      const usersSnapshot = await getDocs(collection(db, 'users'));
      let likeCount = 0;
  
      usersSnapshot.forEach((userDoc) => {
        const favorites = userDoc.data().favorites || [];
        if (favorites.includes(walkwayDocId)) {
          likeCount++;
        }
      });
  
      res.status(200).json({ likes: likeCount });
      console.log(`Walkway ${walkwayId} (docId: ${walkwayDocId}) tem ${likeCount} likes`);
    } catch (error) {
      console.error('Erro ao contar os likes do walkway:', error);
      res.status(500).json({ error: 'Erro interno ao contar os likes' });
    }
  });
  

  //------------------------------- get walkway comments --------------------------------
  app.get('/getWalkwayComments', async (req, res) => {
    const walkwayId = req.query.walkwayId;
    if (!walkwayId) {
      return res.status(400).json({ error: 'Walkway ID is required.' });
    }
  
    try {
      const q = query(collection(db, 'walkways'), where('id', '==', walkwayId));
      const snapshot = await getDocs(q);
  
      if (snapshot.empty) {
        return res.status(404).json({ error: 'Walkway not found.' });
      }
  
      const walkwayDoc = snapshot.docs[0];
      const comments = walkwayDoc.data().publicComments || [];
  
      // Get unique user UIDs from the comments
      const userUids = [...new Set(comments.map(comment => comment.user))];
  
      // Prepare nickname map
      const nicknames = {};
      const usersRef = collection(db, 'users');
  
      // Fetch userId (nickname) for each UID
      for (const uid of userUids) {
        const userSnap = await getDoc(doc(usersRef, uid));
        if (userSnap.exists()) {
          const data = userSnap.data();
          nicknames[uid] = data.userId || uid; // fallback to uid if userId not set
        } else {
          nicknames[uid] = uid;
        }
      }
  
      // Replace user UID with nickname
      const enrichedComments = comments.map(comment => ({
        ...comment,
        user: nicknames[comment.user] || comment.user,
      }));
  
      res.status(200).json({ comments: enrichedComments });
    } catch (error) {
      console.error("Error retrieving comments:", error);
      res.status(500).json({ error: "Error retrieving comments." });
    }
  });  

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
//------------------------------- get all walkways --------------------------------
app.get('/allWalkways', async (req, res) => {
    try {
        const snapshot = await getDocs(WalkwayCollection);
        const walkways = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log('Fetched all walkways.');
        res.status(200).json(walkways);
    } catch (error) {
        console.error('Error fetching all walkways:', error);
        res.status(500).json({ error: 'Failed to fetch walkways' });
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
//------------------------------- delete walkway --------------------------------
app.post('/deleteWalkway', async (req, res) => {
    const { walkwayId } = req.body;

    if (!walkwayId) {
        return res.status(400).json({ error: 'Walkway ID is required.' });
    }

    try {
        const q = query(WalkwayCollection, where('id', '==', parseInt(walkwayId)));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return res.status(404).json({ error: 'Walkway not found.' });
        }

        await deleteDoc(snapshot.docs[0].ref);
        console.log(`Walkway deleted: ${walkwayId}`);
        res.status(200).json({ message: 'Walkway deleted successfully.' });
    } catch (error) {
        console.error('Error deleting walkway:', error);
        res.status(500).json({ error: 'Failed to delete walkway.' });
    }
});

//------------------------------------------------------- CityCoucil Functions ------------------------------------------------------------
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

module.exports = app;
