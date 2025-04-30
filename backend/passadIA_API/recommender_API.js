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

//------------------------------- Global Recommendations ---------------------------------

//-------------------- Top walkways --------------------
app.get('/topWalkways', async (req, res) => {
    try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const walkwaysSnapshot = await getDocs(collection(db, 'walkways'));

        const walkwayIdMap = {};
        walkwaysSnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.id !== undefined) {
                walkwayIdMap[data.id] = doc.id;
            }
        });

        const walkwayLikes = {};

        usersSnapshot.forEach((userDoc) => {
            const userData = userDoc.data();

            (userData.favorites || []).forEach(docId => {
                walkwayLikes[docId] = (walkwayLikes[docId] || 0) + 1;
            });

            (userData.history || []).forEach(entry => {
                const docId = walkwayIdMap[entry.walkwayId];
                if (docId) {
                    walkwayLikes[docId] = (walkwayLikes[docId] || 0) + 1;
                }
            });
        });

        const sortedWalkways = Object.entries(walkwayLikes)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([docId, count]) => ({ docId, count }));

        const topWalkways = sortedWalkways.map(({ docId, count }) => {
            const doc = walkwaysSnapshot.docs.find(d => d.id === docId);
            return doc ? { id: docId, ...doc.data(), count } : null;
        }).filter(Boolean);

        res.status(200).json({ topWalkways });
    } catch (error) {
        console.error('Error fetching top liked walkways:', error);
        res.status(500).json({ error: 'Error fetching top liked walkways' });
    }
});
//-------------------- Top liked walkways --------------------
app.get('/topLikedWalkways', async (req, res) => {
    try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const walkwaysSnapshot = await getDocs(collection(db, 'walkways'));

        const likeCounts = {};

        usersSnapshot.forEach((userDoc) => {
            const userData = userDoc.data();
            (userData.favorites || []).forEach(docId => {
                likeCounts[docId] = (likeCounts[docId] || 0) + 1;
            });
        });

        const sorted = Object.entries(likeCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4) 
            .map(([docId, count]) => {
                const doc = walkwaysSnapshot.docs.find(d => d.id === docId);
                return doc ? { id: docId, ...doc.data(), count } : null;
            })
            .filter(Boolean);
        
        res.status(200).json({ topLikedWalkways: sorted });
    } catch (error) {
        console.error('Error fetching top liked walkways:', error);
        res.status(500).json({ error: 'Error fetching top liked walkways' });
    }
});


//-------------------- Top explored walkways --------------------
app.get('/topExploredWalkways', async (req, res) => {
    try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const walkwaysSnapshot = await getDocs(collection(db, 'walkways'));

        const walkwayIdMap = {};
        walkwaysSnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.id !== undefined) {
                walkwayIdMap[data.id] = doc.id;
            }
        });

        const historyCounts = {};

        usersSnapshot.forEach((userDoc) => {
            const userData = userDoc.data();
            (userData.history || []).forEach(entry => {
                const docId = walkwayIdMap[entry.walkwayId];
                if (docId) {
                    historyCounts[docId] = (historyCounts[docId] || 0) + 1;
                }
            });
        });

        const sorted = Object.entries(historyCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4)
            .map(([docId, count]) => {
                const doc = walkwaysSnapshot.docs.find(d => d.id === docId);
                return doc ? { id: docId, ...doc.data(), count } : null;
            })
            .filter(Boolean);

        res.status(200).json({ topExploredWalkways: sorted });
    } catch (error) {
        console.error('Error fetching top explored walkways:', error);
        res.status(500).json({ error: 'Error fetching top explored walkways' });
    }
});

//------------------------------------------------------- Recomender system Functions ------------------------------------------------------------

//------------------------------- Processing Data --------------------------------
//------------------------------- Parse Distance --------------------------------
const parseDistance = (distanceStr) => {
    if (typeof distanceStr === 'string') {
      const match = distanceStr.match(/[\d.]+/);
      return match ? parseFloat(match[0]) : 0;
    }
    return typeof distanceStr === 'number' ? distanceStr : 0;
  };
//-------------------------------  Normalize Data --------------------------------
const normalize = (vector) => {
    const magnitude = Math.sqrt(vector.distance ** 2 + vector.difficulty ** 2);
    if (magnitude === 0) {
        return { distance: 0, difficulty: 0 }; 
    }
    return {
        distance: vector.distance / magnitude,
        difficulty: vector.difficulty / magnitude
    };
};
//------------------------------- Get Walkway ID Maps --------------------------------
function getWalkwayIdMaps(walkwaysSnapshot) {
    const walkwayIdMap = {};
    const firestoreIdToNumeric = {};
    walkwaysSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.id !== undefined) {
            walkwayIdMap[data.id] = doc.id;
            firestoreIdToNumeric[doc.id] = data.id;
        }
    });
    return { walkwayIdMap, firestoreIdToNumeric };
}

//------------------------------- Get Explored Document IDs --------------------------------
function getExploredDocIds(history, favorites, walkwayIdMap) {
    return new Set([
        ...history.map(h => walkwayIdMap[h.walkwayId] ?? h.walkwayId),
        ...favorites.map(f => walkwayIdMap[f] ?? f)
    ]);
}


//-------------------------------- Collaborative Filtering --------------------------------
//--------------------------------- Jaccard Similarity --------------------------------
function jaccardSimilarity(setA, setB) {
    if (!Array.isArray(setA) || !Array.isArray(setB)) return 0; 

    const intersection = setA.filter(value => setB.includes(value)).length;
    const union = new Set([...setA, ...setB]).size;
    return union === 0 ? 0 : intersection / union;
}
//------------------------------- average similarity --------------------------------
function calculateAverageSimilarity(targetInterests, users) {
    const similarities = users
        .filter(user => user.interests && user.interests.length > 0)
        .map(user => jaccardSimilarity(targetInterests, user.interests))
        .filter(score => score > 0);

    if (similarities.length === 0) return 0;

    const total = similarities.reduce((sum, val) => sum + val, 0);
    return total / similarities.length;
}

//------------------------------- Find Similar Users --------------------------------
async function findSimilarUsers(email, minSimilarity = null, usersSnapshot = null, walkwaysSnapshot = null) {
    if (!usersSnapshot) usersSnapshot = await getDocs(UserCollection);
    if (!walkwaysSnapshot) walkwaysSnapshot = await getDocs(WalkwayCollection);

    const walkwayIdMap = getWalkwayIdMaps(walkwaysSnapshot).walkwayIdMap;

    const currentUserDoc = usersSnapshot.docs.find(doc => doc.data().email === email);
    if (!currentUserDoc) throw new Error('User not found with that email.');

    const currentUser = currentUserDoc.data();
    const targetInterests = currentUser.interests || [];

    const otherUsers = usersSnapshot.docs
        .map(doc => doc.data())
        .filter(user => user.email !== email && user.interests);

    if (minSimilarity === null) {
        minSimilarity = calculateAverageSimilarity(targetInterests, otherUsers);
        console.log(`Limiar dinâmico de similaridade definido em: ${minSimilarity.toFixed(3)}`);
    }

    return usersSnapshot.docs
        .filter(doc => doc.data().email !== email && doc.data().interests)
        .map(doc => {
            const user = doc.data();
            const similarity = jaccardSimilarity(targetInterests, user.interests);
            if (similarity < minSimilarity) return null;

            const fixedHistory = (user.history || []).map(entry => ({
                ...entry,
                walkwayDocId: walkwayIdMap[entry.walkwayId] || entry.walkwayId
            }));

            const fixedFavorites = (user.favorites || []).map(fav =>
                walkwayIdMap[fav] || fav
            );

            return {
                email: user.email,
                interests: user.interests,
                similarity,
                history: fixedHistory,
                favorites: fixedFavorites
            };
        })
        .filter(Boolean);
}

//------------------------------- Recommend Walkways --------------------------------

async function recommendCollaborative(email, minSimilarity = null) {
    console.log(`\nRecommending walkways for user: ${email} with minimum similarity: ${minSimilarity}`);

    const usersSnapshot = await getDocs(UserCollection);
    const walkwaysSnapshot = await getDocs(WalkwayCollection);

    const similarUsers = await findSimilarUsers(email, minSimilarity, usersSnapshot, walkwaysSnapshot);
    console.log(`\n✅ Similar users found: ${similarUsers.length}`);
    similarUsers.forEach(user => {
        console.log(`\n📎 Similar user: ${user.email}`);
        console.log(`🔸 Interests: ${JSON.stringify(user.interests)}`);
        console.log(`🔹 Similarity: ${user.similarity.toFixed(3)}`);
    });

    const targetUserDoc = usersSnapshot.docs.find(doc => doc.data().email === email);
    if (!targetUserDoc) {
        console.error("❌ User not found");
        throw new Error("User not found");
    }

    const targetUser = targetUserDoc.data();
    const targetWalkways = new Set((targetUser.history || []).map(entry => entry.walkwayId));
    const targetFavorites = new Set((targetUser.favorites || []).map(fav => fav.toString()));

    const recommendedWalkwayIds = new Set();

    similarUsers.forEach(user => {
        user.history.forEach(entry => {
            const walkwayId = entry.walkwayDocId;
            if (!targetWalkways.has(walkwayId)) {
                recommendedWalkwayIds.add(walkwayId);
            }
        });

        user.favorites.forEach(fav => {
            if (!targetWalkways.has(fav) && !targetFavorites.has(fav)) {
                recommendedWalkwayIds.add(fav);
            }
        });
    });

    const recommendedWalkways = walkwaysSnapshot.docs
        .filter(doc => recommendedWalkwayIds.has(doc.id))
        .map(doc => ({ id: doc.id, ...doc.data() }));

    console.log(`\n📌 Recommended walkways: ${recommendedWalkways.length}`);
    recommendedWalkways.forEach(w => {
        console.log(`\n🔹 Walkway ID: ${w.id}`);
        console.log(`🔸 Name: ${w.name}`);
        console.log(`🔸 Distance: ${w.specifics.distance}`);
        console.log(`🔸 Difficulty: ${w.specifics.difficulty}`);
    });
    return recommendedWalkways;
}
//------------------------------- Route --------------------------------
app.get('/recommendedCollaborativeWalkways', async (req, res) => {
    try {
        const email = req.session.user?.email || userData.email;

        if (!email) {
            return res.status(401).json({ error: 'User is not authenticated' });
        }

        const recommended = await recommendCollaborative(email);
        return res.status(200).json({ recommendations: recommended.slice(0, 4) });

    } catch (error) {
        console.error(' Error in /recommendedCollaborativeWalkways:', error);
        return res.status(500).json({ error: 'Internal server error while recommending walkways.' });
    }
});


//------------------------------- Content based Filtering --------------------------------
//------------------------------- Euclidean Distance --------------------------------
const euclideanDistance = (a, b) => {
    return Math.sqrt(
        (a.distance - b.distance) ** 2 +
        (a.difficulty - b.difficulty) ** 2
    );
};
//------------------------------- Haversine Distance --------------------------------
const haversine = (lat1, lon1, lat2, lon2) => {
    const toRad = deg => deg * Math.PI / 180;
    const R = 6371; 
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
};

//------------------------------- Merge Unique by ID --------------------------------
function mergeUniqueById(primaryList, secondaryList) {
    const existingIds = new Set(primaryList.map(item => item.id));
    const uniqueFromSecondary = secondaryList.filter(item => !existingIds.has(item.id));
    return [...primaryList, ...uniqueFromSecondary];
}
//------------------------------- Get Explored for Comparison --------------------------------
function getExploredForComparison(history, favorites) {
    const historyIds = new Set(history.map(h => h.id));
    const filteredFavorites = favorites.filter(fav => !historyIds.has(fav.id)); 
    return [...history, ...filteredFavorites]; 
}

//------------------------------- Recommend by Euclidean --------------------------------
const recommendByEuclidean = (history, favorites, allSystemWalkways) => {
    console.log("\n📌 Starting Euclidean-based recommendation");

    const historicIds = new Set(history.map(h => h.id));

    console.log(`📜 User history includes ${history.length} walkway(s):`);
    history.forEach(h => {
        console.log(`   • ${h.name} (id: ${h.id})`);
    });

    const favoritesNotInHistory = favorites.filter(fav => !historicIds.has(fav.id));
    console.log(`⭐ Favorites not in history (${favoritesNotInHistory.length}):`);
    favoritesNotInHistory.forEach(f => {
        console.log(`   • ${f.name} (id: ${f.id})`);
    });

    const unexplored = allSystemWalkways.filter(w => !historicIds.has(w.id));
    console.log(`📂 Unexplored walkways from the system (${unexplored.length}):`);
    unexplored.forEach(w => {
        console.log(`   • ${w.name} (id: ${w.id})`);
    });

    const allExploredForComparison = getExploredForComparison(history, favorites);
    console.log(`🔎 Walkways used for comparison (${allExploredForComparison.length}):`);
    allExploredForComparison.forEach(w => {
        console.log(`   • ${w.name} (id: ${w.id})`);
    });

    const normExplored = allExploredForComparison
        .filter(w => w.specifics && typeof w.specifics.difficulty === 'number')
        .map(w => {
            const normalized = normalize({
                distance: parseDistance(w.specifics.distance),
                difficulty: w.specifics.difficulty
            });
            return { ...w, ...normalized };
        });
    console.log(`📐 Normalized explored walkways: ${normExplored.length}`);

    const allToCompare = mergeUniqueById(unexplored, favoritesNotInHistory);
    console.log(`📊 Total walkways to compare: ${allToCompare.length}`);

    const results = allToCompare
        .filter(w => w.specifics && typeof w.specifics.difficulty === 'number')
        .map(w => {
            const norm = normalize({
                distance: parseDistance(w.specifics.distance),
                difficulty: w.specifics.difficulty
            });

            let minDist = Infinity;
            let closestName = null;

            normExplored.forEach(e => {
                const dist = euclideanDistance(e, norm);
                if (dist < minDist) {
                    minDist = dist;
                    closestName = e.name;
                }
            });

            console.log(`📈 ${w.name} (id: ${w.id}) — closest to "${closestName}" with Euclidean distance: ${minDist.toFixed(3)}`);

            return {
                ...w,
                isFavorite: favorites.some(f => f.id === w.id),
                euclidean: minDist,
                closestTo: closestName
            };
        });

    console.log(` Euclidean recommendation completed with ${results.length} result(s).\n`);
    return results;
};

//------------------------------- Check if Geo Dispersed --------------------------------
const isGeoDispersed = (explored) => {
    const distances = [];

    for (let i = 0; i < explored.length; i++) {
        for (let j = i + 1; j < explored.length; j++) {
            const coord1 = explored[i].coordinates;
            const coord2 = explored[j].coordinates;

            if (
                !coord1 || !coord2 ||
                typeof coord1.latitude !== 'number' || typeof coord1.longitude !== 'number' ||
                typeof coord2.latitude !== 'number' || typeof coord2.longitude !== 'number'
            ) continue;

            const d = haversine(
                coord1.latitude, coord1.longitude,
                coord2.latitude, coord2.longitude
            );

            distances.push(d);
        }
    }

    if (distances.length === 0) return false;

    const mean = distances.reduce((sum, val) => sum + val, 0) / distances.length;
    const stdDev = Math.sqrt(
        distances.reduce((sum, val) => sum + (val - mean) ** 2, 0) / distances.length
    );

    const maxDistance = Math.max(...distances);
    const threshold = mean + stdDev;

    console.log(`\n🌍 Max distance: ${maxDistance.toFixed(2)} km | Mean: ${mean.toFixed(2)} | Std Dev: ${stdDev.toFixed(2)} | Threshold: ${threshold.toFixed(2)} km`);

    return maxDistance > threshold; //
};

//------------------------------- Refine by Geolocation --------------------------------
const refineByGeolocation = (recommended, explored) => {
    if (explored.length === 0) return recommended;

    const allDistances = [];

    const refined = recommended
        .map(candidate => {
            let closestDistance = Infinity;

            for (const reference of explored) {
                if (candidate.id === reference.id) continue;

                const c = candidate.coordinates || {};
                const r = reference.coordinates || {};

                if (
                    typeof c.latitude !== 'number' || typeof c.longitude !== 'number' ||
                    typeof r.latitude !== 'number' || typeof r.longitude !== 'number'
                ) continue;

                const dist = haversine(c.latitude, c.longitude, r.latitude, r.longitude);
                allDistances.push(dist);

                if (dist < closestDistance) {
                    closestDistance = dist;
                }
            }

            return {
                ...candidate,
                distance: closestDistance
            };
        })
        .filter(Boolean); 

    if (allDistances.length === 0) return recommended;

    const mean = allDistances.reduce((sum, val) => sum + val, 0) / allDistances.length;
    const stdDev = Math.sqrt(allDistances.reduce((sum, val) => sum + (val - mean) ** 2, 0) / allDistances.length);
    const threshold = mean + stdDev;

    return refined
        .filter(w => w.distance < threshold)
        .sort((a, b) => a.distance - b.distance);
};


//------------------------------- Get Exploration Context --------------------------------
async function getExplorationContext(email) {
    const usersSnapshot = await getDocs(UserCollection);
    const userDoc = usersSnapshot.docs.find(doc => doc.data().email === email);
    if (!userDoc) throw new Error('User not found');

    const userData = userDoc.data();
    const rawHistory = userData.history || [];
    const rawFavorites = userData.favorites || [];

    const walkwaysSnapshot = await getDocs(WalkwayCollection);
    const allWalkways = walkwaysSnapshot.docs.map(doc => ({
        ...doc.data(),
        docId: doc.id,
        id: doc.data().id
    }));

    const { walkwayIdMap, firestoreIdToNumeric } = getWalkwayIdMaps(walkwaysSnapshot);
    const exploredDocIds = getExploredDocIds(rawHistory, rawFavorites, walkwayIdMap);

    const historyIds = rawHistory.map(h => h.walkwayId);
    const favoriteIds = rawFavorites.map(f => typeof f === 'number' ? f : firestoreIdToNumeric[f]);

    const history = allWalkways.filter(w => historyIds.includes(w.id));
    
    const favorites = allWalkways.filter(w => favoriteIds.includes(w.id));

    const explored = allWalkways.filter(w => exploredDocIds.has(w.docId));
    const unexplored = allWalkways.filter(w => !exploredDocIds.has(w.docId));

    console.log(`📜 User history count: ${history.length}`);
    history.forEach(h => {
        console.log(`   • (id: ${h.id}, docId: ${h.docId}) — ${h.name}`);
    });

    console.log(`⭐ User favorites count: ${favorites.length}`);
    favorites.forEach(f => {
        console.log(`   • (id: ${f.id}, docId: ${f.docId}) — ${f.name}`);
    });

    return {
        userData,
        history,
        favorites,
        allWalkways,
        explored,
        unexplored,
        walkwayIdMap,
        walkwaysSnapshot
    };
}


//-------------------------------  Recommendation Content Based --------------------------------
app.get('/recommendContentBased', async (req, res) => {
    try {
        const email = req.session.user?.email || userData.email;
        if (!email) return res.status(401).json({ error: 'User is not authenticated' });
        console.log(`📨 Content-based recommendation for: ${email}`);

        const {
            favorites,
            history,
            explored,
            unexplored,
        } = await getExplorationContext(email);


        if (history.length === 0 && favorites.length === 0) {
            console.log("⚠️ No explored walkways found.");
            return res.status(200).json([]);
        }

        const euclideanScores = recommendByEuclidean(history, favorites, unexplored);
        console.log(`\n📊 Walkways scored by Euclidean -> ${euclideanScores.length}:`);
        euclideanScores.forEach(w => {
            console.log(`   📈 ${w.name} – closest to "${w.closestTo}" – score: ${w.euclidean.toFixed(3)}`);
        });

        const useGeo = !isGeoDispersed(explored);

        if (useGeo) {
            console.log("\n🌍 Geolocation refinement will be applied.");
        } else {
            console.log("📏 Using pure Euclidean-based recommendation (no geo refinement).");
        }
        
        const scoredRecommendations = useGeo
            ? refineByGeolocation(euclideanScores, explored)
            : euclideanScores.sort((a, b) => a.euclidean - b.euclidean);
        
        console.log(`🔎 Scored recommendations (${scoredRecommendations.length}):`);
        scoredRecommendations.forEach(w => {
            const base = `→ ${w.name} (id: ${w.id})`;
            if (useGeo) {
                console.log(`   ${base} – Distance: ${w.distance?.toFixed(2)} km`);
            } else {
                console.log(`   ${base} – Euclidean: ${w.euclidean?.toFixed(3)}, closest to "${w.closestTo}"`);
            }
        });
        
        const uniqueRecommendations = [...new Map(
            scoredRecommendations.map(w => [w.id, w])
        ).values()];
        
        console.log(`\n🎯 Recommendations after deduplication: ${uniqueRecommendations.length}`);
        uniqueRecommendations.forEach((w, index) => {
            console.log(`   #${index + 1}: ${w.name} (id: ${w.id})`);
        });
        
        res.status(200).json(uniqueRecommendations.slice(0, 4));
        

    } catch (err) {
        console.error('❌ Erro na recomendação baseada em conteúdo:', err);
        res.status(500).json({ error: 'Erro interno no sistema de recomendação.' });
    }
});


//------------------------------------------------------- FINAL Recomender system ------------------------------------------------------------
//-------------------------------  Recommendation Hybrid --------------------------------
app.get('/recommendHybridCascade', async (req, res) => {
    try {
        const email = req.session.user?.email || userData.email;
        if (!email) return res.status(401).json({ error: 'User is not authenticated' });

        console.log(`\n🧠 Hybrid cascade recommendation for: ${email}`);

        const collaborativeRecommendations = await recommendCollaborative(email);
        if (collaborativeRecommendations.length === 0) {
            console.log("⚠️ No collaborative recommendations found.");
            return res.status(200).json([]);
        }

        const {
            favorites,
            history,
            explored,
        } = await getExplorationContext(email);

        if (explored.length === 0) {
            console.log("⚠️ No explored walkways found, skipping content filtering.");
            return res.status(200).json(collaborativeRecommendations.slice(0, 4));
        }

        const euclideanScores = recommendByEuclidean(history, favorites, collaborativeRecommendations);
        if (euclideanScores.length === 0) {
            console.log("⚠️ No Euclidean scores found. Returning collaborative recommendations.");
            return res.status(200).json(collaborativeRecommendations.slice(0, 4));
        }
        console.log(`\n📊 Walkways scored by Euclidean -> ${euclideanScores.length}:`);
        euclideanScores.forEach(w => {
            console.log(`   📈 ${w.name} – closest to "${w.closestTo}" – score: ${w.euclidean.toFixed(3)}`);
        });

        const useGeo = !isGeoDispersed(explored);

        if (useGeo) {
            if(euclideanScores.length === 1) {
                console.log("⚠️ Only one walkway found, skipping geolocation refinement.");
                return res.status(200).json(euclideanScores.slice(0, 4));
            }
            else{
                console.log("\n🌍 Geolocation refinement will be applied.");
            }
        } else {
            console.log("📏 Using pure Euclidean-based recommendation (no geo refinement).");
            return res.status(200).json(euclideanScores.slice(0, 4));
        }
        const scored = useGeo
            ? refineByGeolocation(euclideanScores, explored)
            : euclideanScores.sort((a, b) => a.euclidean - b.euclidean);

        console.log(`🔎 Scored recommendations (${scored.length}):`);
        scored.forEach(w => {
            const base = `→ ${w.name} (id: ${w.id})`;
            if (useGeo) {
                console.log(`   ${base} – Distance: ${w.distance?.toFixed(2)} km`);
            } else {
                console.log(`   ${base} – Euclidean: ${w.euclidean?.toFixed(3)}, closest to "${w.closestTo}"`);
            }
        });
        const finalRecommendations = [...new Map(scored.map(w => [w.id, w])).values()];

        console.log(`\n🎯 Recommendations after deduplication: ${finalRecommendations.length}`);
        finalRecommendations.forEach((w, index) => {
            console.log(`   #${index + 1}: ${w.name} (id: ${w.id})`);
        });
        
        return res.status(200).json(finalRecommendations.slice(0, 4));
    } catch (err) {
        console.error("❌ Error in hybrid cascade recommendation:", err);
        return res.status(500).json({ error: 'Internal error in hybrid recommendation.' });
    }
});



module.exports = app;
