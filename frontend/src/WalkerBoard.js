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

import theme from './Theme/theme';
import logo from './Theme/images/baselogo.jpg';
import walkway0 from './Theme/images/walkway_0.jpg';
import walkway1 from './Theme/images/walkway_1.jpg';
import walkway2 from './Theme/images/walkway_2.jpg';
import walkway3 from './Theme/images/walkway_3.jpg';
import walkway4 from './Theme/images/walkway_4.jpg';

// Styled components using MUI's new styled API
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
// Add 'backgroundImage' as a prop to WalkwayBox
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
  backgroundBlendMode: 'overlay', // Helps with readability
}));

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
  const [geoJsonLoaded, setGeoJsonLoaded] = useState(false); 
  const [topWalkways, setTopWalkways] = useState([]);
  const [recommendedWalkways, setRecommendedWalkways] = useState([]);
  const [walkwayInterests, setWalkwayInterests] = useState([]);
  const mapRef = useRef(null);
  const navigate = useNavigate();

  const imageMap = {
    0: walkway0,
    1: walkway1,
    2: walkway2,
    3: walkway3,
    4: walkway4,
  };

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

  const fetchTopWalkways = async () => {
    try {
      const response = await Axios.get("http://localhost:8080/topLikedWalkways");
      setTopWalkways(response.data.topWalkways);
    } catch (error) {
      console.error("Error fetching top walkways:", error);
    }
  };

  const fetchRecommendedWalkways = async () => {
    try {
      const response = await Axios.get("http://localhost:8080/recommendWalkways");
      setRecommendedWalkways(response.data.recommendations);
      console.log("Recommended Walkways:", response.data.recommendations);
    } catch (error) {
      console.error("Error fetching recommended walkways:", error);
    }
  };

  

  useEffect(() => {
    const checkFavoriteStatus = async () => {
      try {
        const response = await Axios.get("http://localhost:8080/favorites", { withCredentials: true });
        setIsFavorite(response.data.favorites?.some((fav) => fav.id === selectedMarker.id) || false);
      } catch (error) {
        console.error("Error checking favorite status:", error);
      }
    };
    selectedMarker && checkFavoriteStatus();
  }, [selectedMarker]);

  const handleFavoriteClick = async () => {
    try {
      const response = await Axios.post("http://localhost:8080/addFavorite", { locationId: selectedMarker.id }, { withCredentials: true });
      if (response.status === 200) {
        setIsFavorite(true);
        await Axios.post("http://localhost:8080/addPoints", { points: 20 }, { withCredentials: true });
        setSuccess("Marked as favorite! Points added!");
      }
    } catch (error) {
      setError("Failed to mark as favorite: " + (error.response?.data || error.message));
    }
  };

  const handleStartWalkClick = () => navigate('/StartWalk');
  const handleClick = (event) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);
  const handleLogoClick = () => navigate('/WalkerBoard');
  const handleCloseDialog = () => {
    setIsMapLoaded(false); // Reset map load state to force reload
    setGeojsonData(null);   // Clear GeoJSON data to ensure it reloads
    setSelectedMarker(null); // Clear the selected marker
  };
  const handleMarkerClick = useCallback((marker) => setSelectedMarker(marker), []);
  useEffect(() => {
    fetchTopWalkways();
  }, []);
  useEffect(() => {
    fetchRecommendedWalkways();
  }, []);
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
  useEffect(() => {
    const fetchMarkers = async () => {
      try {
        const response = await Axios.get("http://localhost:8080/markers");
        setMarkers(response.data);
      } catch (error) {
        setError('Failed to fetch markers: ' + error.message);
      }
    };
    fetchMarkers();
  }, []);

  const transformedMarkers = markers
    .filter(marker => marker.coordinates) // Filter out any marker without coordinates
    .map(marker => ({
      ...marker,
      position: {
        lat: marker.coordinates.latitude,
        lng: marker.coordinates.longitude,
      },
      name: marker.name || 'Unknown Name', // Fallback for missing names
      description: marker.description || 'No description available', // Fallback for missing descriptions
      image: marker.primaryImage || 'default_image.jpg', // Fallback for missing image
      distance: marker.specifics?.distance || 'Unknown Distance', // Safe access for nested properties
      difficulty: marker.specifics?.difficulty || 'Unknown Difficulty',
      region: marker.region || 'Unknown Region',
      district: marker.district || 'Unknown District',
      defaultCenter: { lat: marker.coordinates.latitude, lng: marker.coordinates.longitude },
      interests: marker.interests|| 'No Interests Available',
  }));

  useEffect(() => {
    if (selectedMarker) {
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
    }
  }, [selectedMarker]);

  const handleMapLoad = (mapInstance) => {
    const googleMap = mapInstance.map || mapInstance.googleMap;
    setIsMapLoaded(true);
    mapRef.current = googleMap;
  };

  useEffect(() => {
    if (isMapLoaded && mapRef.current && geojsonData && !geoJsonLoaded) {
      console.log("Map and GeoJSON data are ready.");
  
      try {
        const dataLayer = new window.google.maps.Data();
        dataLayer.setMap(mapRef.current);
  
        // Clear previous GeoJSON data
        dataLayer.forEach((feature) => dataLayer.remove(feature));
  
        // Ensure coordinates are valid numbers and in correct [lat, lng] format
        const validateAndTransformGeoJson = (geoJson) => {
          geoJson.features.forEach((feature) => {
            //console.log("Processing feature:", feature); // Log the entire feature
        
            if (feature.geometry.type === 'Point') {
              let coordinates = feature.geometry.coordinates;
        
              if (Array.isArray(coordinates) && coordinates.length === 2) {
                let [lng, lat] = coordinates;
                if (typeof lat === 'number' && typeof lng === 'number') {
                  feature.geometry.coordinates = [lat, lng]; // Reverse to [lat, lng]
                  //console.log("Transformed Point coordinates:", feature.geometry.coordinates);
                } else {
                  //console.warn("Invalid coordinates in Point feature:", coordinates);
                  feature.geometry.coordinates = null; // Set to null if invalid
                }
              } else {
                //console.warn("Invalid or missing Point coordinates:", coordinates);
                feature.geometry.coordinates = null; // Set to null if not in correct format
              }
            } else if (feature.geometry.type === 'MultiLineString') {
              feature.geometry.coordinates = feature.geometry.coordinates.map((lineString) => {
                if (Array.isArray(lineString)) {
                  return lineString
                    .map(([lng, lat]) => {
                      if (typeof lat === 'number' && typeof lng === 'number') {
                        //console.log("Transforming MultiLineString coordinate:", [lat, lng]);
                        return [lat, lng]; // Reverse coordinates
                      } else {
                        console.warn("Invalid coordinates in MultiLineString feature:", [lng, lat]);
                        return null; // Return null if invalid
                      }
                    })
                    .filter(Boolean); // Remove any invalid coordinate pairs
                } else {
                  console.warn("Invalid lineString in MultiLineString feature:", lineString);
                  return null; // Return null if not an array
                }
              }).filter(Boolean); // Remove any invalid lineStrings
            }
          });
        
          // Filter out any features with invalid coordinates
          geoJson.features = geoJson.features.filter((feature) => feature.geometry.coordinates !== null);
          return geoJson;
        };
        
        
        
  
        const validatedGeoJson = validateAndTransformGeoJson(
          typeof geojsonData === 'string' ? JSON.parse(geojsonData) : geojsonData
        );
  
        // Add validated GeoJSON data to the map
        dataLayer.addGeoJson(validatedGeoJson);
  
        // Set styles for GeoJSON features
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
  
        // Fit the map bounds to the GeoJSON data
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
        console.error("Error adding GeoJSON to the map:", error);
      }
    } else {
      console.log("Map or GeoJSON data is not ready.");
    }
  }, [isMapLoaded, geojsonData, geoJsonLoaded]);
  
  useEffect(() => {
    if (selectedMarker) {
      // Calculate difficulty when the selected marker changes
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

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppContainer>
        <APIProvider apiKey={'AIzaSyDwGfxyjM21tprpmkBXNI6HGIuwzvLsBgo'}>
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
              mapId='5f6b01e0c09b0450'
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
                  <img src={imageMap[selectedMarker?.id]} alt={selectedMarker?.name} style={{ maxWidth: '100%', marginBottom: '20px' }} />
                  <Typography gutterBottom color="primary"><strong>District:</strong> {selectedMarker?.district}</Typography>
                  <Typography gutterBottom color="primary"><strong>Region:</strong> {selectedMarker?.region}</Typography>
                  <Typography gutterBottom color="secondary"><strong>Difficulty:</strong> {difficulty}</Typography>
                  <Typography gutterBottom><strong>Description:</strong> {selectedMarker?.description}</Typography>
                </>
              )}
              {tabIndex === 1 && selectedMarker && (
                <Map
                  defaultZoom={12}
                  defaultCenter={selectedMarker?.defaultCenter}
                  mapId="5f6b01e0c09b0450"
                  onIdle={handleMapLoad}
                  style={{ height: '600px', width: '100%' }}
                  
                />
              )}
              {tabIndex === 2 && <Typography>List of services offered along the walkway can be added here.</Typography>}
            </DialogContent>
            <DialogActions>
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
              <Button variant="contained" color="secondary" startIcon={<DirectionsWalkIcon />} onClick={handleStartWalkClick}>
                Start Walk
              </Button>
            </DialogActions>
          </Dialog>
          {/* Seção Top Walkways */}
          <Typography variant="h6" color="primary" style={{ marginTop: theme.spacing(10), textAlign: 'left' }}>
            Top Walkways Users Liked
          </Typography>

          <TopWalkwaysContainer style={{ justifyContent: 'flex-start' }}>
            {topWalkways.map((walkway, index) => (
              <WalkwayBox
                key={walkway.id}
                onClick={() => handleTopWalkwayClick(walkway.id)}
                style={{ width: '300px', height: '180px' }} // Define o tamanho fixo das caixas
              >
                <img 
                  src={imageMap[walkway.id] || 'default_image.jpg'} 
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
                  style={{ width: '300px', height: '180px' }} // Fixed box size
                >
                  <img 
                    src={imageMap[walkway.id] || 'default_image.jpg'} 
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


          <LogoutButton variant="contained" color="secondary" onClick={handleLogOut}>Logout</LogoutButton>
        </APIProvider>
      </AppContainer>
    </ThemeProvider>
  );
};

export default WalkerBoard;
