const express = require('express');
const app = express.Router();
const cors = require('cors');
const cookieParser = require("cookie-parser");
const http = require('http');
const { UserCollection, auth, db, WalkwayCollection, InterestCollection, storage } = require('../firebase-config');
const { getStorage } = require("firebase/storage");
const { addDoc, getDocs, updateDoc, doc, collection, query, where , getDoc, setDoc, arrayUnion, deleteDoc} = require('firebase/firestore');
const { c, u } = require('tar');
const markers = require('../walkways/markers.json');
const multer = require('multer');
const { ref, uploadBytes, getDownloadURL } = require('firebase/storage');
const { v4: uuidv4 } = require('uuid'); 
const upload = multer({ storage: multer.memoryStorage() });
let userData = {};


app.get('/google-maps-key', (req, res) => {
    const apiKey = 'AIzaSyDwGfxyjM21tprpmkBXNI6HGIuwzvLsBgo';
    if (!apiKey) {
      return res.status(500).json({ error: 'Google Maps API key not configured' });
    }
    res.status(200).json({ apiKey });
  });
  
app.get('/google-maps-mapID', (req, res) => {   
    const mapID = '5f6b01e0c09b0450';
    if (!mapID) {
        return res.status(500).json({ error: 'Google Maps Map ID not configured' });
    }
    res.status(200).json({ mapID });
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

        const walkwayQuery = query(collection(db, 'walkways'), where('id', '==', walkwayId));
        const walkwaySnapshot = await getDocs(walkwayQuery);

        if (walkwaySnapshot.empty) {
            return res.status(404).json({ error: 'Walkway not found' });
        }

        const walkwayDoc = walkwaySnapshot.docs[0];
        const difficulty = walkwayDoc.data()?.specifics?.difficulty || 1;

        const difficultyPoints = {
            1: 50,   
            2: 100,  
            3: 200   
        };

        const updatedHistory = currentHistory.map(entry => {
            if (entry.walkwayId === walkwayId) {
                alreadyFinished = entry.finished;
                historyUpdated = true;

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

        console.log(` Histórico ${historyUpdated ? 'atualizado' : 'adicionado'} para ${email}. Pontos: +${finished ? (difficultyPoints[difficulty] || 50) : 0}`);

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
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', email));
        const userSnapshot = await getDocs(q);
      
        if (userSnapshot.empty) {
          return res.status(404).json({ error: 'Utilizador não encontrado.' });
        }
      
        const userData = userSnapshot.docs[0].data();
        const history = userData.history || [];
      
        const walkwayQuery = query(collection(db, 'walkways'), where('id', '==', walkwayId));
        const walkwaySnapshot = await getDocs(walkwayQuery);
      
        if (walkwaySnapshot.empty) {
          return res.status(404).json({ error: 'Passadiço não encontrado.' });
        }
      
        const walkwayFirestoreId = walkwaySnapshot.docs[0].id;
      
        const entry = history.find(entry => entry.walkwayId === walkwayFirestoreId);
      
        if (!entry) {
          return res.json({ status: 'none' });
        }
      
        const status = entry.finished ? 'completed' : 'started';
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
        const q = query(WalkwayCollection, where('id', '==', parseInt(walkwayId)));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return res.status(404).json({ error: 'Walkway não encontrado' });
        }

        const docData = snapshot.docs[0].data();
        const comments = docData.publicComments || [];

        res.status(200).json({ comments });
        console.log(` Comentários para walkway ${walkwayId}:`, comments);
    } catch (err) {
        console.error(' Erro ao obter comentários:', err);
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
      const walkwayQuery = query(WalkwayCollection, where('id', '==', parseInt(walkwayId)));
      const walkwaySnapshot = await getDocs(walkwayQuery);
  
      if (walkwaySnapshot.empty) {
        return res.status(404).json({ error: 'Passadiço não encontrado' });
      }
  
      const walkwayDocId = walkwaySnapshot.docs[0].id;
  
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
  
      const userUids = [...new Set(comments.map(comment => comment.user))];
  
      const nicknames = {};
      const usersRef = collection(db, 'users');
  
      for (const uid of userUids) {
        const userSnap = await getDoc(doc(usersRef, uid));
        if (userSnap.exists()) {
          const data = userSnap.data();
          nicknames[uid] = data.userId || uid; 
        } else {
          nicknames[uid] = uid;
        }
      }
  
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
        if (!Array.isArray(markers)) {
            return res.status(400).json({ message: 'Invalid data format. Markers should be an array.' });
        }

        const collectionRef = collection(db, 'walkways');

        for (const marker of markers) {
            await addDoc(collectionRef, marker);
        }

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
        const collectionRef = collection(db, 'walkways');

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
    const { walkwayId } = req.query;

    if (!walkwayId) {
        return res.status(400).json({ message: 'Walkway ID is required.' });
    }

    try {
        const walkwayQuery = query(collection(db, 'walkways'), where('id', '==', parseInt(walkwayId)));
        const walkwaySnapshot = await getDocs(walkwayQuery);

        if (walkwaySnapshot.empty) {
            return res.status(404).json({ message: 'Walkway not found.' });
        }

        const walkwayDoc = walkwaySnapshot.docs[0];
        const geojsonSource = walkwayDoc.data().geojson;

        if (!geojsonSource) {
            return res.status(404).json({ message: 'GeoJSON not found for this walkway.' });
        }

        let geojson;

        if (geojsonSource.startsWith('http')) {
            const response = await fetch(geojsonSource);
            if (!response.ok) {
                throw new Error(`Failed to fetch GeoJSON from storage: ${response.statusText}`);
            }
            geojson = await response.json(); 
        } else {
            geojson = JSON.parse(geojsonSource);
        }

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
      const {
        name,
        description,
        district,
        region,
        coordinates,
        specifics,
        trajectory
      } = req.body;
  
      const latitude = coordinates?.latitude;
      const longitude = coordinates?.longitude;
      const difficulty = specifics?.difficulty;
      const distance = specifics?.distance;
      const startLatitude = trajectory?.start?.latitude;
      const startLongitude = trajectory?.start?.longitude;
      const endLatitude = trajectory?.end?.latitude;
      const endLongitude = trajectory?.end?.longitude;
      const round = trajectory?.round;
  
      if (!name || !description || !latitude || !longitude || !district || !region ||
        !difficulty || !distance || !startLatitude || !startLongitude || !endLatitude || !endLongitude) {
        return res.status(400).json({ message: 'Missing required fields.' });
      }
  
      const allWalkways = await getDocs(WalkwayCollection);
      let maxId = 0;
      allWalkways.forEach(doc => {
        const walkway = doc.data();
        if (typeof walkway.id === 'number' && walkway.id > maxId) {
          maxId = walkway.id;
        }
      });
      const nextId = maxId + 1;
  
      let geojsonUrl = null;
      if (req.files?.geojson) {
        const geojsonFile = req.files['geojson'][0];
        const geojsonRef = ref(storage, `geojson/${uuidv4()}_${geojsonFile.originalname}`);
        await uploadBytes(geojsonRef, geojsonFile.buffer);
        geojsonUrl = await getDownloadURL(geojsonRef);
      } else if (req.body.geojson) {
        geojsonUrl = req.body.geojson;
      }
  
      let primaryImageUrl = null;
      if (req.files?.primaryImage) {
        const imageFile = req.files['primaryImage'][0];
        const imageRef = ref(storage, `images/${uuidv4()}_${imageFile.originalname}`);
        await uploadBytes(imageRef, imageFile.buffer);
        primaryImageUrl = await getDownloadURL(imageRef);
      } else if (req.body.primaryImage) {
        primaryImageUrl = req.body.primaryImage;
      }
  
      const formattedDistance = `${parseFloat(distance).toFixed(1)} km`;
  
      const walkwayData = {
        id: nextId,
        name,
        description,
        coordinates: {
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
        },
        district,
        geojson: geojsonUrl || null,
        primaryImage: primaryImageUrl || null,
        region,
        specifics: {
          difficulty: parseInt(difficulty),
          distance: formattedDistance
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
          round: round === 'true',
        },
      };
  
      await addDoc(WalkwayCollection, walkwayData);
  
      res.status(200).json({ message: 'Walkway successfully added to the collection.', walkwayId: nextId });
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
        const walkwayDoc = doc(WalkwayCollection, walkwayId);

        const geojsonString = JSON.stringify(geojson);

        await setDoc(walkwayDoc, { geojson: geojsonString }, { merge: true });

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
        const walkwayDoc = doc(WalkwayCollection, walkwayId);

        if (!pictureURL.startsWith('http')) {
            return res.status(400).json({ message: 'Invalid picture URL.' });
        }

        await updateDoc(walkwayDoc, { pictures: arrayUnion(pictureURL) });

        res.status(200).json({ message: 'Picture added to walkway document.' });
    } catch (error) {
        console.error('Error adding picture to walkway document:', error);
        res.status(500).json({ message: 'Failed to add picture to walkway document.', error: error.message });
    }
});

//------------------------------- Add Walkway To My List of Created Walkways --------------------------------

app.post('/addWalkwayToMyList', async (req, res) => {
    const rawId = req.body.walkwayId;
    const walkwayId = parseInt(rawId); 
    const email = req.session.user?.email;

    if (!email || isNaN(walkwayId)) {
        return res.status(400).json({ error: 'Valid email and numeric walkway ID are required' });
    }

    try {
        const usersRef = collection(db, 'users');
        const userQuery = query(usersRef, where('email', '==', email));
        const userSnapshot = await getDocs(userQuery);

        if (userSnapshot.empty) {
            return res.status(404).json({ error: 'User not found' });
        }

        const userDocRef = userSnapshot.docs[0].ref;
        const userData = userSnapshot.docs[0].data();
        const createdWalkways = userData.createdWalkways || [];

        const walkwayQuery = query(WalkwayCollection, where('id', '==', walkwayId));
        const walkwaySnapshot = await getDocs(walkwayQuery);

        if (walkwaySnapshot.empty) {
            return res.status(404).json({ error: 'Walkway not found' });
        }

        const walkwayDocId = walkwaySnapshot.docs[0].id;

        if (createdWalkways.includes(walkwayDocId)) {
            return res.status(400).json({ error: 'Walkway already in your list' });
        }

        createdWalkways.push(walkwayDocId);
        await updateDoc(userDocRef, { createdWalkways });

        res.status(200).json({ message: 'Walkway added to your list', docId: walkwayDocId });
        console.log(`✔️ Walkway ${walkwayId} (docId=${walkwayDocId}) added to ${email}'s list`);
    } catch (error) {
        console.error('Error adding walkway to user list:', error);
        res.status(500).json({ error: 'Error adding walkway to user list' });
    }
});


//------------------------------- Get my list of walkways --------------------------------
app.get('/myWalkways', async (req, res) => {
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
        const createdWalkways = userData.createdWalkways || [];

        if (createdWalkways.length === 0) {
            return res.status(200).json({ message: 'No walkways found', walkways: [] });
        }

        const walkways = [];

        for (const docId of createdWalkways) {
            try {
                const walkwayDocRef = doc(WalkwayCollection, docId);
                const walkwayDoc = await getDoc(walkwayDocRef);

                if (walkwayDoc.exists()) {
                    const data = walkwayDoc.data();
                    
                    walkways.push({
                        docId,
                        name: data.name,
                        description: data.description,
                        district: data.district || '',
                        region: data.region || '',
                        primaryImage: data.primaryImage || null
                      });
                      
                } else {
                    console.warn(`Walkway document with ID ${docId} not found.`);
                }
            } catch (err) {
                console.error(`Error fetching walkway with Firestore doc ID ${docId}:`, err);
            }
        }

        res.status(200).json({ walkways });
    } catch (error) {
        console.error('Error fetching created walkways:', error);
        res.status(500).json({ error: 'Error fetching created walkways' });
    }
});

//------------------------------- Remove Walkway From all Walkways ------------------------------
app.post('/removeWalkway', async (req, res) => {
    const walkwayId = req.body.walkwayId;
    const email = req.session.user?.email;
  
    if (!email) {
      return res.status(401).json({ error: 'User is not authenticated' });
    }
  
    if (!walkwayId || isNaN(walkwayId)) {
      return res.status(400).json({ error: 'Valid walkway ID is required.' });
    }
  
    try {
      const usersRef = collection(db, 'users');
      const userQuery = query(usersRef, where('email', '==', email));
      const userSnapshot = await getDocs(userQuery);
      if (userSnapshot.empty) {
        return res.status(404).json({ error: 'User not found' });
      }
  
      const userDocRef = userSnapshot.docs[0].ref;
      const userData = userSnapshot.docs[0].data();
      const createdWalkways = userData.createdWalkways || [];
  
      const walkwayQuery = query(WalkwayCollection, where('id', '==', walkwayId));
      const walkwaySnapshot = await getDocs(walkwayQuery);
      if (walkwaySnapshot.empty) {
        return res.status(404).json({ error: 'Walkway not found' });
      }
  
      const walkwayDocRef = walkwaySnapshot.docs[0].ref;
      const walkwayDocId = walkwaySnapshot.docs[0].id;
  
      if (!createdWalkways.includes(walkwayDocId)) {
        return res.status(403).json({ error: 'You do not have permission to delete this walkway' });
      }
  
      const updatedCreatedWalkways = createdWalkways.filter(id => id !== walkwayDocId);
      await updateDoc(userDocRef, { createdWalkways: updatedCreatedWalkways });
  
      await deleteDoc(walkwayDocRef);
  
      console.log(`✔️ Walkway ${walkwayId} removed successfully. by ${email}`);
      res.status(200).json({ message: 'Walkway removed successfully.' });
  
    } catch (error) {
      console.error(' Error removing walkway:', error);
      res.status(500).json({ error: 'Error removing walkway.' });
    }
  });

//------------------------------- Update Walkway --------------------------------
app.post('/updateWalkway', upload.single('primaryImage'), async (req, res) => {
    try {
      const { walkwayId, name, description, district, region } = req.body;
  
      if (!walkwayId) {
        return res.status(400).json({ error: 'Walkway ID is required.' });
      }
  
      const docRef = doc(WalkwayCollection, walkwayId);
      const snapshot = await getDoc(docRef)
      if (!snapshot.exists()) {
        return res.status(404).json({ error: 'Walkway not found.' });
      }
  
      const updates = { name, description, district, region };
      Object.keys(updates).forEach(key => {
        if (updates[key] === undefined || updates[key] === null || updates[key] === '') {
          delete updates[key];
        }
      });
  
      if (req.file) {
        const imageRef = ref(storage, `images/${uuidv4()}_${req.file.originalname}`);
        await uploadBytes(imageRef, req.file.buffer);
        const imageUrl = await getDownloadURL(imageRef);
        updates.primaryImage = imageUrl;
      }
  
      await updateDoc(docRef, updates);
  
      res.status(200).json({ message: 'Walkway updated successfully.', updates });
    } catch (error) {
      console.error("Error updating walkway:", error);
      res.status(500).json({ error: "Failed to update walkway.", details: error.message });
    }
  });
  
  
  
  
module.exports = app;
