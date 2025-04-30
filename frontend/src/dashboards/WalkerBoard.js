import React, { useEffect, useState, useRef, useCallback } from "react";
import Axios from "axios";
import {
  Menu, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions, Tabs, Tab, IconButton,
  Button, Container, CssBaseline, Typography, Paper, ThemeProvider, Box
} from '@mui/material';
import { styled } from '@mui/system';
import CloseIcon from '@mui/icons-material/Close';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import FavoriteIcon from '@mui/icons-material/Favorite';
import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk';
import { APIProvider, AdvancedMarker, Map, Pin } from '@vis.gl/react-google-maps';
import { useNavigate } from 'react-router-dom';

import theme from '../Theme/theme';
import logo from '../Theme/images/baselogo.jpg';

const AppContainer = styled(Container)(({ theme }) => ({
  ...theme.root,
  zIndex: 9999,
}));

const Logo = styled('img')(({ theme }) => ({
  position: 'absolute',
  top: theme.spacing(4),
  left: theme.spacing(50),
  width: '200px',
  height: 'auto',
  cursor: 'pointer',
}));

const MapContainer = styled(Paper)(({ theme }) => ({
  height: '500px',
  width: '100%',
  display: 'flex',
  overflowX: 'auto',
  marginTop: theme.spacing(80),
}));

const LogoutButton = styled(Button)({
  position: 'absolute',
  right: 100,
  top: 20,
});

const MoreMenuButton = styled(IconButton)({
  position: 'absolute',
  right: 20,
  top: 20,
});

const TopWalkwaysContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  overflowX: 'auto',

}));
const RecommendedWalkwaysContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  overflowX: 'auto',

}));
const WalkwayBox = styled(Paper)(({ theme, backgroundImage }) => ({
  minWidth: '200px',
  height: '150px',
  margin: theme.spacing(1),
  cursor: 'pointer',
  backgroundImage: `url(${backgroundImage})`,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  color: theme.palette.primary.contrastText,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'flex-end',
  padding: theme.spacing(1),
  transition: 'transform 0.2s, box-shadow 0.2s',
  '&:hover': {
    transform: 'scale(1.05)',
    boxShadow: theme.shadows[6],
  },
  backgroundBlendMode: 'overlay', 
}));

//--------------------- Main Component ---------------------//

const WalkerBoard = ({ onLogout }) => {
  const [error, setError] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [success, setSuccess] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [difficulty, setDifficulty] = useState('Unknown');
  const [tabIndex, setTabIndex] = useState(0);
  const [geojsonData, setGeojsonData] = useState(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [topLikedWalkways, setTopLikedWalkways] = useState([]);
  const [topExploredWalkways, setTopExploredWalkways] = useState([]);
  const [recommendedWalkways, setRecommendedWalkways] = useState([]);
  const [isStarted, setIsStarted] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [comment, setComment] = useState('');
  const [storedComment, setStoredComment] = useState(null);
  const [publicComments, setPublicComments] = useState([]);
  const [walkwayLikes, setWalkwayLikes] = useState(0);
  const [userHistory, setUserHistory] = useState([]);
  const [googleApiKey, setGoogleApiKey] = useState(null);
  const [mapid, setMapId] = useState(null);
  const mapRef = useRef(null);
  const navigate = useNavigate();
  const dataLayerRef = useRef(null);

//--------------------- Menu Handlers ---------------------//
  const handleClick = (event) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);
  const handleLogoClick = () => navigate('/WalkerBoard');
  const handleTabChange = (_, newValue) => setTabIndex(newValue);
  const handleLogOut = async () => {
    setError(null);
    setSuccess(null);
    try {
      await Axios.get("http://localhost:8080/logout", { withCredentials: true });
      console.log("Logged out successfully!");
      onLogout && onLogout();
      setSuccess('Log out successful!');
      navigate('/App');
    } catch (error) {
    }
  };
  const handleCloseDialog = () => {
    setIsMapLoaded(false); 
    setGeojsonData(null);  
    setSelectedMarker(null);
    setTabIndex(0);
    setComment('');
    setAnchorEl(null);
  };

  //--------------------- Map Load Handler ---------------------//
  useEffect(() => {
    const fetchApiKey = async () => {
      try {
        const response = await Axios.get('http://localhost:8080/google-maps-key', { withCredentials: true });
        const mapId = await Axios.get('http://localhost:8080/google-maps-mapID', { withCredentials: true });
        setGoogleApiKey(response.data.apiKey);
        setMapId(mapId.data.mapID);
      } catch (err) {
        console.error('Erro ao buscar a Google Maps API key or map id:', err);
      }
    };
  
    fetchApiKey();
  }, []);
  const handleMapLoad = (mapInstance) => {
    const googleMap = mapInstance.map || mapInstance.googleMap;
    setIsMapLoaded(true);
    mapRef.current = googleMap;
  };

  useEffect(() => {
    if (!isMapLoaded || !mapRef.current || !geojsonData) return;
  
    try {
      if (dataLayerRef.current) {
        dataLayerRef.current.setMap(null);
      }
  
      const dataLayer = new window.google.maps.Data();
      dataLayer.setMap(mapRef.current);
      dataLayerRef.current = dataLayer;
  
      const validateAndTransformGeoJson = (geoJson) => {
        geoJson.features.forEach((feature) => {
          if (feature.geometry.type === 'Point') {
            const [lng, lat] = feature.geometry.coordinates;
            feature.geometry.coordinates = [lat, lng];
          } else if (feature.geometry.type === 'MultiLineString') {
            feature.geometry.coordinates = feature.geometry.coordinates.map((line) =>
              line.map(([lng, lat]) => [lat, lng])
            );
          }
        });
        return geoJson;
      };
  
      const validatedGeoJson = validateAndTransformGeoJson(
        typeof geojsonData === 'string' ? JSON.parse(geojsonData) : geojsonData
      );
  
      dataLayer.addGeoJson(validatedGeoJson);
  
      dataLayer.setStyle((feature) => {
        const geometryType = feature.getGeometry().getType();
        if (geometryType === 'LineString' || geometryType === 'MultiLineString') {
          return { strokeColor: 'blue', strokeWeight: 3, clickable: false };
        } else if (geometryType === 'Point') {
          return {
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 6,
              fillColor: 'red',
              fillOpacity: 1,
              strokeWeight: 2,
              strokeColor: 'white',
            },
          };
        }
      });
  
      const bounds = new window.google.maps.LatLngBounds();
      dataLayer.forEach((feature) => {
        const geometry = feature.getGeometry();
        if (geometry.getType() === 'Point') {
          bounds.extend(geometry.get());
        } else if (geometry.getType() === 'LineString' || geometry.getType() === 'MultiLineString') {
          geometry.getArray().forEach(bounds.extend);
        }
      });
  
      if (!bounds.isEmpty()) {
        mapRef.current.fitBounds(bounds);
      }
    } catch (error) {
      console.error("Error processing GeoJSON:", error);
    }
  }, [geojsonData, isMapLoaded]);

  useEffect(() => {
    if (selectedMarker) {
      const calculateDifficulty = (difficultyLevel) => {
        if (difficultyLevel === 1) {
          return 'Easy';
        } else if (difficultyLevel === 2) {
          return 'Medium';
        } else if (difficultyLevel === 3) {
          return 'Hard';
        } else {
          return 'Unknown';
        }
      };
  
      setDifficulty(calculateDifficulty(selectedMarker.difficulty));
    }
  }, [selectedMarker]);

  //--------------------- Fetch Markers ---------------------//
  useEffect(() => {
    const fetchMarkers = async () => {
      try {
        const response = await Axios.get("http://localhost:8080/markers", { withCredentials: true });
        setMarkers(response.data);
      } catch (error) {
        setError('Failed to fetch markers: ' + error.message);
      }
    };
    fetchMarkers();
  }, []);

  const transformedMarkers = markers
  .filter(marker => typeof marker.id === 'number' && marker.coordinates)
    .map(marker => ({
      ...marker,
      position: {
        lat: marker.coordinates.latitude,
        lng: marker.coordinates.longitude,
      },
      name: marker.name || 'Unknown Name', 
      description: marker.description || 'No description available', 
      image: marker.primaryImage || 'default_image.jpg', 
      distance: marker.specifics?.distance || 'Unknown Distance', 
      difficulty: marker.specifics?.difficulty || 'Unknown Difficulty',
      region: marker.region || 'Unknown Region',
      district: marker.district || 'Unknown District',
      defaultCenter: { lat: marker.coordinates.latitude, lng: marker.coordinates.longitude },
      interests: marker.interests|| 'No Interests Available',
  }));

  const handleMarkerClick = async (marker) => {
    if (marker?.id === undefined && marker?.walkwayId === undefined) return;
  
    setSelectedMarker(marker);
  
    const walkwayId = marker.walkwayId || marker.id;
  
    try {
      const commentsRes = await Axios.get(`http://localhost:8080/getWalkwayComments?walkwayId=${walkwayId}`);
      setPublicComments(commentsRes.data.comments || []);
      console.log("Fetched comments:", commentsRes.data.comments);
  
      const likesRes = await Axios.get(`http://localhost:8080/walkwayLikes?walkwayId=${walkwayId}`);
      setWalkwayLikes(likesRes.data.likes || 0);
      await checkWalkwayStatus(walkwayId);
    } catch (err) {
      console.error("Error getting comments or likes:", err);
    }
  };
  useEffect(() => {
    if (selectedMarker?.id === undefined || selectedMarker?.id === null) return;
      Axios.get(`http://localhost:8080/getGeojson`, { params: { walkwayId: selectedMarker.id } })
        .then(({ data: { geojson } }) => {
          geojson.features.forEach((feature) => {
            if (feature.geometry.type === 'Point') {
              const [lng, lat] = feature.geometry.coordinates;
              feature.geometry.coordinates = [lat, lng];
            } else if (feature.geometry.type === 'MultiLineString') {
              feature.geometry.coordinates = feature.geometry.coordinates.map(line =>
                line.map(([lng, lat]) => [lat, lng])
              );
            }
          });
          setGeojsonData(geojson);
        })
        .catch((error) => console.error('Error fetching GeoJSON:', error));
    
  }, [selectedMarker]);
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await Axios.get("http://localhost:8080/history", { withCredentials: true });
        setUserHistory(response.data.history || []);
        console.log("User history:", response.data.history);
  
        if (selectedMarker) {
          updateMarkerState(response.data.history, selectedMarker);
        }
  
      } catch (error) {
        console.error("Error getting user history:", error);
      }
    };
    fetchHistory();
  }, []);
  const updateMarkerState = (history, marker) => {
    const entry = history.find(entry => entry.walkwayId === marker.id);
    if (entry) {
      if (entry.finished) {
        setIsCompleted(true);
        setIsStarted(false);
        setStoredComment(entry.experience || null);
      } else {
        setIsCompleted(false);
        setIsStarted(true);
        setStoredComment(null);
      }
    } else {
      setIsCompleted(false);
      setIsStarted(false);
      setStoredComment(null);
    }
  };

  //--------------------- Event Walk Handlers ---------------------//
  const handleStartWalk = async () => {
    try {
      const response = await Axios.post("http://localhost:8080/addWalkwayHistory", {
        walkwayId: selectedMarker.id,
        walkwayName: selectedMarker.name,
        startDate: new Date().toISOString(),
        endDate: null,
        distanceCompleted: 0,
        finished: false,
        timeSpent: null,
        experience: ""
      }, { withCredentials: true });
  
      const newEntry = {
        walkwayId: selectedMarker.id,
        walkwayName: selectedMarker.name,
        startDate: new Date().toISOString(),
        endDate: null,
        distanceCompleted: 0,
        finished: false,
        timeSpent: null,
        experience: ""
      };
  
      updateHistoryEntry(newEntry);
  
      setSuccess("Walk started!");
      setIsStarted(true);
      setIsCompleted(false);
      setStoredComment(null);
  
      updateMarkerState([...userHistory, newEntry], selectedMarker);
  
    } catch (error) {
      setError("Failed to start the walk: " + error.message);
    }
  };
  
  const handleCompleteWalk = async () => {
    try {
      const response = await Axios.post("http://localhost:8080/addWalkwayHistory", {
        walkwayId: selectedMarker.id,
        walkwayName: selectedMarker.name,
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
        distanceCompleted: 0,
        finished: true,
        timeSpent: null
      },{
        withCredentials: true
      });
      updateHistoryEntry({
        walkwayId: selectedMarker.id,
        walkwayName: selectedMarker.name,
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
        distanceCompleted: 0,
        finished: true,
        timeSpent: null,
        experience: storedComment || ""
      });
      setSuccess("Walk successfully added to your history!");
      setIsStarted(false);
      setIsCompleted(true);
      setComment(''); 
    } catch (err) {
      setError("Failed to mark as completed: " + err.message);
    }
  };
  const updateHistoryEntry = (newEntry) => {
    setUserHistory(prev => {
      const existingIndex = prev.findIndex(e => e.walkwayId === newEntry.walkwayId);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = { ...updated[existingIndex], ...newEntry };
        return updated;
      } else {
        return [...prev, newEntry];
      }
    });
  };
  
  const checkWalkwayStatus = async (walkwayId) => {
    if (!walkwayId) return;
  
    try {
      const res = await Axios.get(`http://localhost:8080/walkwayStatus?walkwayId=${walkwayId}`, {
        withCredentials: true
      });
  
      const { status, comment } = res.data;
  
      if (status === 'completed') {
        setIsCompleted(true);
        setIsStarted(false);
        setStoredComment(comment);
      } else if (status === 'started') {
        setIsCompleted(false);
        setIsStarted(true);
        setStoredComment(null);
      } 
  
    } catch (err) {
      console.error("Error checking walkway status:", err);
    }
  };
  
  
//--------------------- Check Favorite Status ---------------------//
  useEffect(() => {
    const checkFavoriteStatus = async () => {
      try {
        const response = await Axios.get("http://localhost:8080/favorites", { withCredentials: true });
        setIsFavorite(response.data.favorites?.some((fav) => fav.id === selectedMarker.id || fav.id === selectedMarker?.id.toString()) ||
        response.data.favorites?.some((fav) => fav.id == selectedMarker.id) ||
        response.data.favorites?.some((fav) => fav.id === selectedMarker?.walkwayId) ||
        response.data.favorites?.some((fav) => fav.id === selectedMarker?.walkwayId?.toString())
        );
      } catch (error) {
        console.error("Error checking favorite status:", error);
      }
    };
    selectedMarker && checkFavoriteStatus();
  }, [selectedMarker]);
  const handleFavoriteClick = async () => {
    try {
      const response = await Axios.post(
        "http://localhost:8080/addFavorite",
        { locationId: selectedMarker.id },
        { withCredentials: true }
      );
  
      if (response.status === 200) {
        setIsFavorite(true);
        setSuccess("Marked as favorite! Points added!");
      }
    } catch (error) {
      setError("Failed to mark as favorite: " + (error.response?.data || error.message));
    }
  };

//--------------------- Fetch Public Comments ---------------------//
  useEffect(() => {
    if (!selectedMarker) return;
  
    const fetchPublicComments = async (walkwayId) => {
      try {
        const response = await Axios.get(`http://localhost:8080/getWalkwayComments?walkwayId=${walkwayId}`);
        setPublicComments(response.data.comments || []);
      } catch (error) {
        console.error("Error fetching public comments:", error);
      }
    };
  
    fetchPublicComments(selectedMarker.id);
    updateMarkerState(userHistory, selectedMarker);
  
  }, [selectedMarker, userHistory]);
  
  const handleSubmitComment = async () => {
    try {
      await Axios.post("http://localhost:8080/addPublicComment", {
        walkwayId: selectedMarker.id,  
        experience: comment,
      }, { withCredentials: true });
  
      setPublicComments(prev => [
        ...prev,
        { user: "You", experience: comment, timestamp: new Date().toISOString() }
      ]);
  
      updateHistoryEntry({
        walkwayId: selectedMarker.id,
        experience: comment,
      });
  
      setSuccess("Comment added successfully!");
      setStoredComment(comment);
      setComment('');
    } catch (err) {
      console.error(" Failed to submit comment:", err);
      setError("Failed to submit comment: " + err.message);
    }
  };
  
  //--------------------- Fetch Top Walkways ---------------------//
  useEffect(() => {
    fetchTopWalkways();
  }, []);
  useEffect(() => {
    fetchTopExploredWalkways();
  }, []);
  useEffect(() => {
    fetchRecommendedWalkways();
  }, [userHistory, isFavorite]);
  
  const handleTopWalkwayClick = (walkwayId) => {
    const marker = markers.find((marker) => marker.id === walkwayId);
    if (marker) {
      handleMarkerClick(marker);
      if (mapRef.current) {
        mapRef.current.panTo(marker.position);
        mapRef.current.setZoom(14);
      }
    }
  };
  const fetchTopWalkways = async () => {
    try {
      const response = await Axios.get("http://localhost:8080/topLikedWalkways",{
        withCredentials: true
      });
      setTopLikedWalkways(response.data.topLikedWalkways);
    } catch (error) {
      console.error("Error fetching top liked walkways:", error);
    }
  };
  const handleTopExploredWalkwayClick = (walkwayId) => {
    const marker = markers.find((marker) => marker.id === walkwayId);
    if (marker) {
      handleMarkerClick(marker);
      if (mapRef.current) {
        mapRef.current.panTo(marker.position);
        mapRef.current.setZoom(14);
      }
    }
  };
  const fetchTopExploredWalkways = async () => {
    try {
      const response = await Axios.get("http://localhost:8080/topExploredWalkways",{
        withCredentials: true
      });
      setTopExploredWalkways(response.data.topExploredWalkways);
    } catch (error) {
      console.error("Error fetching top explored walkways:", error);
    }
  };

  const fetchRecommendedWalkways = async () => {
    try {
      const response = await Axios.get("http://localhost:8080/recommendHybridCascade",{
        withCredentials: true
      });
      setRecommendedWalkways(response.data);
      console.log("Recommended Walkways:", response.data); 
    } catch (error) {
      console.error("Error fetching recommended walkways:", error);
    }
  };
  

//--------------------- Render Component ---------------------//  
  
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppContainer>
      {googleApiKey && (
          <APIProvider apiKey={googleApiKey}>
          <Logo src={logo} alt="logo" onClick={handleLogoClick} />
          <MoreMenuButton aria-label="more" onClick={handleClick}>
            <MoreVertIcon />
          </MoreMenuButton>
          <Menu anchorEl={anchorEl} keepMounted open={Boolean(anchorEl)} onClose={handleClose}>
            <MenuItem onClick={() => { handleClose(); navigate('/Profile'); }}>Profile</MenuItem>
            <MenuItem onClick={() => { handleClose(); navigate('/History'); }}>History</MenuItem>
            <MenuItem onClick={() => { handleClose(); navigate('/Favorites'); }}>Favorites</MenuItem>
          </Menu>
          <MapContainer>
            <Map
              defaultZoom={10}
              defaultCenter={{ lat: 41.5564, lng: -8.16415 }}
              mapId={mapid}
              mapTypeId="terrain"
              //onIdle={handleMapLoad}
            >
              {transformedMarkers.map((marker) => (
                <AdvancedMarker
                  key={marker.id}
                  position={marker.position}
                  clickable={true}
                  onClick={() => handleMarkerClick(marker)}
                >
                  <Pin background={theme.palette.primary.secondary} borderColor={theme.palette.primary.main} glyphColor={theme.palette.primary.contrastText} />
                </AdvancedMarker>
              ))}
            </Map>
          </MapContainer>
          <Dialog open={selectedMarker !== null} onClose={handleCloseDialog} fullWidth>
            <DialogTitle>
              {selectedMarker?.name}
              <IconButton aria-label="close" onClick={handleCloseDialog}><CloseIcon /></IconButton>
            </DialogTitle>
            <Tabs value={tabIndex} onChange={handleTabChange}>
              <Tab label="Overview" />
              <Tab label="Walkway" />
              <Tab label="Services" />
            </Tabs>
            <DialogContent dividers>
              {tabIndex === 0 && (
                <>
                  <img
                    src={selectedMarker?.primaryImage}
                    alt={selectedMarker?.name}
                    style={{ maxWidth: '100%', marginBottom: '20px' }}
                  />                  
                  <Typography gutterBottom color="primary"><strong>District:</strong> {selectedMarker?.district}</Typography>
                  <Typography gutterBottom color="primary"><strong>Region:</strong> {selectedMarker?.region}</Typography>
                  <Typography gutterBottom color="secondary"><strong>Difficulty:</strong> {difficulty}</Typography>
                  <Typography gutterBottom><strong>Distance:</strong> {selectedMarker?.distance}</Typography>
                  <Typography gutterBottom><strong>Description:</strong> {selectedMarker?.description}</Typography>
                  {storedComment && (
                    <Typography style={{ marginTop: 16 }}>
                      <strong>User comment:</strong> {storedComment}
                    </Typography>
                  )}
                  {publicComments.length > 0 && (
                    <>
                      <Typography variant="h6" style={{ marginTop: 24 }}>Comments:</Typography>
                      {publicComments.map((c, index) => (
                        <Paper key={index} style={{ padding: 8, marginBottom: 6 }}>
                          <Typography variant="body2"><strong>{c.user}</strong>: {c.experience}</Typography>
                          <Typography variant="caption" color="textSecondary">{new Date(c.timestamp).toLocaleString()}</Typography>
                        </Paper>
                      ))}
                    </>
                  )}
                  {selectedMarker && isCompleted && !isStarted && (
                    <>
                      <Typography gutterBottom style={{ marginTop: 16 }}><strong>Leave a comment about your experience:</strong></Typography>
                      <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        rows={3}
                        style={{ width: '100%', padding: '8px', marginBottom: '8px' }}
                        placeholder="Write your comment here..."
                      />
                      <Button
                        variant="contained"
                        color="primary"
                        onClick={handleSubmitComment}
                      >
                        Submit Comment
                      </Button>
                    </>
                  )}
                </>
              )}
              {tabIndex === 1 && selectedMarker && (
                 <Map
                 key={selectedMarker.id}
                 defaultZoom={14}
                 defaultCenter={{
                   lat: selectedMarker?.coordinates?.latitude,
                   lng: selectedMarker?.coordinates?.longitude
                 }}
                 mapId="5f6b01e0c09b0450"
                 onIdle={handleMapLoad}
                 style={{ height: '600px', width: '100%' }}
               />
              )}
              {tabIndex === 2 && <Typography>List of services offered along the walkway can be checked here.</Typography>}
            </DialogContent>
            <DialogActions>
              <Typography variant="body2" color="textSecondary">
                ❤️ {walkwayLikes} likes
              </Typography>

              <div>
                {!isFavorite ? (
                  <Button variant="contained" color="primary" startIcon={<FavoriteIcon />} onClick={handleFavoriteClick}>
                    Mark as Favorite
                  </Button>
                ) : (
                  <Button variant="contained" disabled>
                    This location is already marked as favorite!
                  </Button>
                )}
                {error && <div style={{ color: "red" }}>{error}</div>}
                {success && <div style={{ color: "green" }}>{success}</div>}
              </div>

              {selectedMarker && isCompleted && (
                <Button
                  variant="outlined"
                  color="secondary"
                  startIcon={<DirectionsWalkIcon />}
                  onClick={handleStartWalk}
                >
                  Start to walk again
                </Button>
              )}

              {selectedMarker && !isStarted && !isCompleted && (
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={<DirectionsWalkIcon />}
                  onClick={handleStartWalk}
                >
                  Start this walk
                </Button>
              )}

              {selectedMarker && isStarted && !isCompleted && (
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<DirectionsWalkIcon />}
                  onClick={handleCompleteWalk}
                >
                  Mark as completed
                </Button>
              )}
            </DialogActions>

          </Dialog>
          <Typography variant="h6" color="primary" style={{ marginTop: theme.spacing(10), textAlign: 'left' }}>
            Top Walkways Users Liked
          </Typography>

          <TopWalkwaysContainer style={{ justifyContent: 'flex-start' }}>
            {topLikedWalkways.map((walkway, index) => (
              <WalkwayBox
                key={walkway.id}
                onClick={() => handleTopWalkwayClick(walkway.id)}
                style={{ width: '300px', height: '180px' }} 
              >
                <img 
                  src={walkway.primaryImage} 
                  alt={walkway.name} 
                  style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '4px' }}
                />
                <Typography variant="subtitle1" style={{ fontWeight: 'bold', marginTop: theme.spacing(1), color: '#333' }}>
                  {walkway.name}
                </Typography>
                <Typography variant="body2" style={{ color: '#666' }}>
                  Distance: {walkway.specifics.distance} | Difficulty: {walkway.specifics.difficulty}
                </Typography>
              </WalkwayBox>
            ))}
          </TopWalkwaysContainer>
          <Typography variant="h6" color="primary" style={{ marginTop: theme.spacing(10), textAlign: 'left' }}>
            Walkways that may interest you
          </Typography>
          <RecommendedWalkwaysContainer style={{ justifyContent: 'flex-start' }}>
            {Array.isArray(recommendedWalkways) && recommendedWalkways.length > 0 ? (
              recommendedWalkways.map((walkway, index) => (
                <WalkwayBox
                  key={walkway.id}
                  onClick={() => handleTopWalkwayClick(walkway.id)}
                  style={{ width: '300px', height: '180px' }} 
                >
                  <img 
                    src={walkway.primaryImage } 
                    alt={walkway.name} 
                    style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '4px' }}
                  />
                  <Typography variant="subtitle1" style={{ fontWeight: 'bold', marginTop: theme.spacing(1), color: '#333' }}>
                    {walkway.name}
                  </Typography>
                  <Typography variant="body2" style={{ color: '#666' }}>
                    Distance: {walkway.specifics.distance} | Difficulty: {walkway.specifics.difficulty}
                  </Typography>
                </WalkwayBox>
              ))
            ) : (
              <Typography variant="body2" style={{ color: '#666', padding: theme.spacing(2) }}>
                No recommended walkways available.
              </Typography>
            )}
          </RecommendedWalkwaysContainer>
          <Typography variant="h6" color="primary" style={{ marginTop: theme.spacing(10), textAlign: 'left' }}>
            Top Walkways Users Walked
          </Typography>
          <TopWalkwaysContainer style={{ justifyContent: 'flex-start' }}>
            {topExploredWalkways.map((walkway, index) => (
              <WalkwayBox
                key={walkway.id}
                onClick={() => handleTopExploredWalkwayClick(walkway.id)}
                style={{ width: '300px', height: '180px' }} 
              >
                <img 
                  src={walkway.primaryImage} 
                  alt={walkway.name} 
                  style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '4px' }}
                />
                <Typography variant="subtitle1" style={{ fontWeight: 'bold', marginTop: theme.spacing(1), color: '#333' }}>
                  {walkway.name}
                </Typography>
                <Typography variant="body2" style={{ color: '#666' }}>
                  Distance: {walkway.specifics.distance} | Difficulty: {walkway.specifics.difficulty}
                </Typography>
              </WalkwayBox>
            ))}
          </TopWalkwaysContainer>

          <LogoutButton variant="contained" color="secondary" onClick={handleLogOut}>Logout</LogoutButton>
        </APIProvider>
      )}
      </AppContainer>
    </ThemeProvider>
  );
};

export default WalkerBoard;
