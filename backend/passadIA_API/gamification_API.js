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


//------------------------------------------------------- Gamification Functions ------------------------------------------------------------
//------------------------------- award points for existing comments --------------------------------
app.post('/awardPointsForExistingComments', async (req, res) => {
    try {
      const userCommentCounts = {};
  
      const walkwaysSnapshot = await getDocs(WalkwayCollection);
      walkwaysSnapshot.forEach((doc) => {
        const data = doc.data();
        const comments = data.publicComments || [];
  
        comments.forEach(comment => {
          const userId = comment.user;
          if (userId) {
            userCommentCounts[userId] = (userCommentCounts[userId] || 0) + 1;
          }
        });
      });
  
      const usersSnapshot = await getDocs(UserCollection);
      let updatedCount = 0;
  
      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        const userId = userData.userId;
  
        if (userCommentCounts[userId]) {
          const numComments = userCommentCounts[userId];
          const additionalPoints = numComments * 30;
  
          const currentPoints = userData.points || 0;
          const newPoints = currentPoints + additionalPoints;
  
          await updateDoc(userDoc.ref, { points: newPoints });
          updatedCount++;
          console.log(`✔️ Pontos atualizados para ${userId}: +${additionalPoints} (Total: ${newPoints})`);
        }
      }
  
      res.status(200).json({ message: `Pontos atribuídos a ${updatedCount} utilizador(es).` });
    } catch (error) {
      console.error('Erro ao atribuir pontos:', error);
      res.status(500).json({ error: 'Erro ao atribuir pontos com base nos comentários existentes.' });
    }
  });
  
//------------------------------- add points to user --------------------------------
app.post('/addPoints', async (req, res) => {
    const { points } = req.body;
    const email = req.session.user?.email || userData.email;

    if (!email || !points) {
        return res.status(400).json({ error: 'Email and points are required' });
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
        const currentPoints = userData.points || 0;

        const updatedPoints = currentPoints + points;

        await updateDoc(userDocRef, { points: updatedPoints });

        res.status(200).json({ message: 'Points added successfully' });
        console.log('Points added to user:', email);

    } catch (error) {
        console.error('Error adding points:', error);
        res.status(500).json({ error: 'Error adding points' });
    }
});

//------------------------------- get user points --------------------------------
app.get('/points', async (req, res) => {
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
        const points = userData.points || 0;

        res.status(200).json({ points });
    } catch (error) {
        console.error('Error fetching points:', error);
        res.status(500).json({ error: 'Error fetching points' });
    }
});
//------------------------------- get user level --------------------------------
// level 1 -> "Beginner" -> 0-299 points
// level 2 -> "Intermediate" -> 300-999 points
// level 3 -> "Advanced" -> 1000-2999 points
// level 4 -> "Expert" -> 3000-9999 points
// level 5 -> "Supreme Explorer" -> 10000+ points
app.get('/level', async (req, res) => {
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
        const points = userData.points || 0;

        let level;
        if (points < 300) {
            level = 'Beginner';
        } else if (points < 1000) {
            level = 'Intermediate';
        } else if (points < 3000) {
            level = 'Advanced';
        } else if (points < 10000) {
            level = 'Expert';
        } else {
            level = 'Supreme Explorer';
        }

        res.status(200).json({ level });
    } catch (error) {
        console.error('Error fetching level:', error);
        res.status(500).json({ error: 'Error fetching level' });
    }
});

//------------------------------- get user level by userId --------------------------------
app.get('/getLevelByEmail/:email', async (req, res) => {
    const email = req.params.email;

    try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', email));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return res.status(404).json({ error: 'User not found' });
        }

        const userData = snapshot.docs[0].data();
        const points = userData.points || 0;

        let level;
        if (points < 300) level = 'Beginner';
        else if (points < 1000) level = 'Intermediate';
        else if (points < 3000) level = 'Advanced';
        else if (points < 10000) level = 'Expert';
        else level = 'Supreme Explorer';

        return res.status(200).json({ level });
    } catch (err) {
        console.error('Error fetching level by email:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

  
//------------------------------- get user rank --------------------------------
app.get('/rank', async (req, res) => {
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
        const points = userData.points || 0;

        const allUsersSnapshot = await getDocs(usersRef);
        const allUsers = allUsersSnapshot.docs.map(doc => doc.data());
        allUsers.sort((a, b) => b.points - a.points);

        const userRank = allUsers.findIndex(user => user.email === email) + 1;

        res.status(200).json({ rank: userRank });
    } catch (error) {
        console.error('Error fetching rank:', error);
        res.status(500).json({ error: 'Error fetching rank' });
    }
});

  
//------------------------------- add public comment --------------------------------
app.post('/addPublicComment', async (req, res) => {
    const { walkwayId, experience } = req.body;
    const email = req.session.user?.email;
  
    if (!email || !walkwayId || !experience) {
      return res.status(400).json({ error: 'Email, walkway ID e experiência são obrigatórios.' });
    }
  
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', email));
      const snapshot = await getDocs(q);
  
      if (snapshot.empty) {
        return res.status(404).json({ error: 'Utilizador não encontrado.' });
      }
  
      const userDoc = snapshot.docs[0];
      const userData = userDoc.data();
      const customUserId = userData.userId || userDoc.id;
  
      const walkwayQuery = query(collection(db, 'walkways'), where('id', '==', walkwayId));
      const walkwaySnap = await getDocs(walkwayQuery);
  
      if (walkwaySnap.empty) {
        return res.status(404).json({ error: 'Passadiço não encontrado.' });
      }
  
      const walkwayDoc = walkwaySnap.docs[0];
      const docRef = walkwayDoc.ref;
      const currentComments = walkwayDoc.data().publicComments || [];
  
      const newComment = {
        user: customUserId,
        experience,
        timestamp: new Date().toISOString()
      };
  
      await updateDoc(docRef, {
        publicComments: [...currentComments, newComment]
      });
  
      await updateDoc(userDoc.ref, {
        points: (userData.points || 0) + 30
      });
  
      const history = userData.history || [];
      const updatedHistory = history.map(entry => {
        if (entry.walkwayId === walkwayId) {
          return { ...entry, experience };
        }
        return entry;
      });
  
      await updateDoc(userDoc.ref, {
        history: updatedHistory
      });
  
      res.status(200).json({ message: 'Comentário adicionado com sucesso e histórico atualizado.' });
      console.log(`🟢 Comentário e histórico atualizados para o passadiço ${walkwayId} por ${customUserId}`);
    } catch (error) {
      console.error('❌ Erro ao adicionar comentário público e atualizar histórico:', error);
      res.status(500).json({ error: 'Erro ao adicionar comentário público e atualizar histórico.' });
    }
  });
  
//------------------------------- migrate comments from history to public comments --------------------------------
app.post('/migrateComments', async (req, res) => {
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
  
      for (const userDoc of usersSnapshot.docs) {
        const userFirestoreId = userDoc.id;
        const userData = userDoc.data();
        const { history = [], userId } = userData;
  
        if (!userId) {
          console.warn(`Utilizador ${userFirestoreId} não tem campo userId`);
          continue;
        }
  
        for (const entry of history) {
          if (entry.finished && entry.experience) {
            const { walkwayId, experience, startDate } = entry;
  
            const walkwayRef = doc(db, 'walkways', walkwayId);
            const walkwayDoc = await getDoc(walkwayRef);
  
            if (walkwayDoc.exists()) {
              const currentComments = walkwayDoc.data().publicComments || [];
  
              const newComment = {
                user: userId, 
                experience,
                timestamp: startDate || new Date().toISOString(),
              };
  
              await updateDoc(walkwayRef, {
                publicComments: [...currentComments, newComment],
              });
  
              console.log(`Comentário migrado de ${userId} para walkway ${walkwayId}`);
            } else {
              console.warn(`Walkway com id ${walkwayId} não encontrado`);
            }
          }
        }
      }
  
      res.status(200).json({ message: 'Migração concluída com sucesso!' });
    } catch (error) {
      console.error("Erro ao migrar comentários:", error);
      res.status(500).json({ error: 'Erro ao migrar comentários.' });
    }
  });

module.exports = app;
