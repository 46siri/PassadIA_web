import React, { useEffect, useState, useRef, useCallback } from "react";
import Axios from "axios";
import {
  Menu, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions, Tabs, Tab, IconButton,
  Button, Container, CssBaseline, Typography, Paper, ThemeProvider, TextField, FormControl, FormLabel, Box
} from '@mui/material';
import Snackbar from '@mui/material/Snackbar';
import MuiAlert from '@mui/material/Alert';
import { styled } from '@mui/system';
import CloseIcon from '@mui/icons-material/Close';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { APIProvider, AdvancedMarker, Map, Pin } from '@vis.gl/react-google-maps';
import { useNavigate } from 'react-router-dom';

import theme from '../Theme/theme';
import logo from '../Theme/images/baselogo.jpg';

// Styled components using MUI's new styled API
const AppContainer = styled(Container)(({ theme }) => ({
  ...theme.root,
  zIndex: 9999,
}));

const Logo = styled('img')(({ theme }) => ({
  position: 'absolute',
  top: theme.spacing(2),
  left: theme.spacing(50),
  width: '200px',
  height: 'auto',
  cursor: 'pointer',
}));

const MapContainer = styled(Paper)(({ theme }) => ({
  height: '500px',
  width: '100%',
}));

const NewWalkwayContainer = styled(Paper)(({ theme }) => ({
  height: '600px',
  width: '100%',
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
const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

const CityCouncilBoard = ({ onLogout }) => {
  const [error, setError] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [success, setSuccess] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [selectedMarker, setSelectedMarker] = useState(null)
  const [difficulty, setDifficulty] = useState('Unknown');
  const [tabIndex, setTabIndex] = useState(0);
  const [geojsonData, setGeojsonData] = useState(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [geoJsonLoaded, setGeoJsonLoaded] = useState(false); 
  const [geoJsonInputType, setGeoJsonInputType] = useState('text');

  const [hasCenteredOnce, setHasCenteredOnce] = useState(false);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    description: '',
    coordinates: { latitude: 0, longitude: 0 },
    district: '',
    geojson: '',
    primaryImage: '',
    region: '',
    specifics: { difficulty: '', distance: '', maxHeight: '', minHeight: '' },
    trajectory: { start: { latitude: 0, longitude: 0 }, end: { latitude: 0, longitude: 0 }, round: false }
  });
  const [showFormDialog, setShowFormDialog] = useState(false);
  const navigate = useNavigate();
  const mapRef = useRef(null);

  const dataLayerRef = useRef(null);

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
      setError('Failed to log out: ' + error.message);
    }
  };

  const handleClick = (event) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);
  const handleLogoClick = () => navigate('/CityCouncilBoard');
  const handleCloseDialog = () => {
    setIsMapLoaded(false); // Reset map load state to force reload
    setGeojsonData(null);   // Clear GeoJSON data to ensure it reloads
    setSelectedMarker(null); // Clear the selected marker
  };
  const handleMarkerClick = async (marker) => {
    if (marker?.id === undefined && marker?.walkwayId === undefined) return;
  
    setSelectedMarker(marker);
    };
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
  
  
  const handleFormChange = (event) => {
    const { name, value } = event.target;
    const keys = name.split('.');
    let newValue = value;
  
    if (name.includes('latitude') || name.includes('longitude') || name.includes('distance')) {
      newValue = value.replace(',', '.');
    }
  
    setFormData((prev) => {
      const updated = { ...prev };
      let current = updated;
  
      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (!current[key] || typeof current[key] !== 'object') {
          current[key] = {};
        }
        current = current[key];
      }
  
      current[keys[keys.length - 1]] = newValue;
      return updated;
    });
  };
  
  const handleAddWalkway = async (e) => {
    e.preventDefault();
    console.log("Form data before submission:", formData);
  
    try {
      const requiredFields = [
        formData.name,
        formData.description,
        formData.district,
        formData.region,
        formData.trajectory.start.latitude,
        formData.trajectory.start.longitude,
        formData.trajectory.end.latitude,
        formData.trajectory.end.longitude,
        formData.specifics.difficulty,
        formData.specifics.distance,
      ];
      console.log("Required fields:", requiredFields);
      if (requiredFields.some((field) => field === '' || field === null || field === undefined)) {
        setError('Please fill in all required fields.');
        return;
      }
  
      const data = new FormData();
  
      data.append("name", formData.name);
      data.append("description", formData.description);
      data.append("district", formData.district);
      data.append("region", formData.region);

      data.append("coordinates[latitude]", formData.trajectory.start.latitude);
      data.append("coordinates[longitude]", formData.trajectory.start.longitude);

      data.append("specifics[difficulty]", formData.specifics.difficulty);
      data.append("specifics[distance]", formData.specifics.distance);

      data.append("trajectory[start][latitude]", formData.trajectory.start.latitude);
      data.append("trajectory[start][longitude]", formData.trajectory.start.longitude);
      data.append("trajectory[end][latitude]", formData.trajectory.end.latitude);
      data.append("trajectory[end][longitude]", formData.trajectory.end.longitude);
      data.append("trajectory[round]", formData.trajectory.round.toString());
      
      if (formData.geojson) {
        if (formData.geojson instanceof File) {
          data.append("geojson", formData.geojson);
        } else {
          const blob = new Blob([formData.geojson], { type: "application/json" });
          data.append("geojson", blob, "geojson.json");
        }
      }
  
      if (formData.primaryImage && formData.primaryImage instanceof File) {
        data.append("primaryImage", formData.primaryImage);
      }
      const addResponse = await Axios.post("http://localhost:8080/addWalkway", data, {
        withCredentials: true,
      });
      const createdId = addResponse.data?.walkwayId;
      if (!createdId) {
        throw new Error("Walkway was added but no ID was returned.");
      }
      await Axios.post("http://localhost:8080/addWalkwayToMyList", {
        walkwayId: createdId,
      }, { withCredentials: true });

      setSuccess('Walkway added and linked to your list successfully!');
      setError(null);
      setShowFormDialog(false);
      
      setFormData({
        name: '',
        description: '',
        coordinates: { latitude: '', longitude: '' },
        district: '',
        geojson: '',
        primaryImage: '',
        region: '',
        specifics: { difficulty: '', distance: '' },
        trajectory: { start: { latitude: '', longitude: '' }, end: { latitude: '', longitude: '' }, round: false }
      });
  
    } catch (error) {
      console.error('Failed to add walkway:', error);
      setError('Failed to add walkway: ' + (error?.response?.data?.message || error.message));
      setSuccess(null);
    }
  };
  

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      coordinates: { ...prev.trajectory.start }
    }));
  }, [formData.trajectory.start]);
  

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
  }));

  const handleMapLoad = (mapInstance) => {
    const googleMap = mapInstance.map || mapInstance.googleMap;
    setIsMapLoaded(true);
    mapRef.current = googleMap;
  };

  useEffect(() => {
    if (!isMapLoaded || !mapRef.current || !geojsonData) return;
  
    try {
      // Limpa o anterior se existir
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
  useEffect(() => {
    setHasCenteredOnce(false); // Recentrar no próximo load
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
            <MenuItem onClick={() => { handleClose(); navigate('/CityCouncilProfile'); }}>Profile</MenuItem>
            <MenuItem onClick={() => { handleClose(); navigate('/MyWalkways'); }}>My Walkways</MenuItem>
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
          </Dialog>
          <Button variant="contained" color="primary" onClick={() => setShowFormDialog(true)} style={{ marginTop: '20px' }}>
             Add New Walkway
          </Button>

          <Dialog open={showFormDialog} onClose={() => setShowFormDialog(false)} fullWidth>
            <DialogTitle>Add New Walkway</DialogTitle>
            <DialogContent>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAddWalkway(e);
                }}
              >
                <TextField required label="Name" name="name" onChange={handleFormChange} fullWidth margin="normal" />
                <TextField required label="Description" name="description" onChange={handleFormChange} fullWidth margin="normal" />
                <Box display="flex" gap={2}>
                  <TextField
                    required
                    label="Start Latitude"
                    name="trajectory.start.latitude"
                    type="text"
                    value={formData.trajectory.start.latitude}
                    onChange={handleFormChange}
                    fullWidth
                    margin="normal"
                  />
                  <TextField
                    required
                    label="Start Longitude"
                    name="trajectory.start.longitude"
                    type="text"
                    value={formData.trajectory.start.longitude}
                    onChange={handleFormChange}
                    fullWidth
                    margin="normal"
                  />
                </Box>
                <Box display="flex" gap={2}>
                  <TextField
                    required
                    label="End Latitude"
                    name="trajectory.end.latitude"
                    type="text"
                    value={formData.trajectory.end.latitude}
                    onChange={handleFormChange}
                    fullWidth
                    margin="normal"
                  />
                  <TextField
                    required
                    label="End Longitude"
                    name="trajectory.end.longitude"
                    type="text"
                    value={formData.trajectory.end.longitude}
                    onChange={handleFormChange}
                    fullWidth
                    margin="normal"
                  />
                </Box>
                <TextField required label="District" name="district" onChange={handleFormChange} fullWidth margin="normal" />
                <FormControl fullWidth margin="normal" variant="outlined" sx={{ border: '1px solid rgba(0, 0, 0, 0.23)', borderRadius: 1, padding: '8px' }}>
                  <FormLabel>GeoJSON</FormLabel>
                  <Button variant="outlined" size="small" onClick={() => setGeoJsonInputType(prev => (prev === 'text' ? 'file' : 'text'))}>
                    {geoJsonInputType === 'text' ? 'Switch to File Input' : 'Switch to Text Input'}
                  </Button>
                  {geoJsonInputType === 'text' ? (
                    <TextField /*required*/ name="geojson" label="Enter GeoJSON" onChange={handleFormChange} fullWidth margin="normal" />
                  ) : (
                    <input
                      /*required*/
                      type="file"
                      name="geojson"
                      accept=".geojson,.json"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = () => {
                            setFormData((prev) => ({ ...prev, geojson: reader.result }));
                          };
                          reader.readAsText(file);
                        }
                      }}
                      style={{ marginTop: '8px', marginBottom: '8px', display: 'block', width: '100%' }}
                    />
                  )}
                </FormControl>

                <FormControl fullWidth margin="normal" variant="outlined" sx={{ border: '1px solid rgba(0, 0, 0, 0.23)', borderRadius: 1, padding: '8px' }}>
                  <FormLabel>Walkway Image</FormLabel>
                  <input
                    /*required*/
                    type="file"
                    name="primaryImage"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      setFormData((prev) => ({ ...prev, primaryImage: file }));
                    }}
                    style={{ width: '100%', display: 'block', padding: '8px' }}
                  />
                </FormControl>

                <TextField required label="Region" name="region" onChange={handleFormChange} fullWidth margin="normal" />
                <TextField required label="Difficulty" name="specifics.difficulty" type="number" onChange={handleFormChange} fullWidth margin="normal" />
                <TextField
                  required
                  label="Distance (km)"
                  name="specifics.distance"
                  type="text"
                  value={formData.specifics.distance}
                  onChange={(e) => {
                    // Convert commas to dots for parsing, but keep the display with commas
                    const value = e.target.value.replace(',', '.');
                    if (/^\d*(,\d{0,2})?$/.test(e.target.value) || value === '') {
                      setFormData((prev) => ({
                        ...prev,
                        specifics: { ...prev.specifics, distance: e.target.value },
                      }));
                    }
                  }}
                  fullWidth
                  margin="normal"
                />
                <FormControl fullWidth margin="normal">
                  <FormLabel sx={{ fontSize: '1.2rem' }}>Round Trip</FormLabel>
                  <select
                    name="trajectory.round"
                    value={formData.trajectory.round}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        trajectory: {
                          ...prev.trajectory,
                          round: e.target.value === "true"
                        }
                      }))
                    }
                    style={{
                      padding: '18px',
                      borderRadius: '4px',
                      fontSize: '1.1rem' // aumenta o tamanho da letra
                    }}
                  >
                    <option value="false" style={{ fontSize: '1.1rem' }}>No</option>
                    <option value="true" style={{ fontSize: '1.1rem' }}>Yes</option>
                  </select>
                </FormControl>
                <DialogActions>
                  <Button type="submit" variant="contained" color="primary">
                    Submit
                  </Button>
                  <Button onClick={() => setShowFormDialog(false)} color="secondary">
                    Cancel
                  </Button>
                  <Snackbar open={!!success} autoHideDuration={4000} onClose={() => setSuccess(null)}>
                    <Alert onClose={() => setSuccess(null)} severity="success">
                      {success}
                    </Alert>
                  </Snackbar>
                </DialogActions>              
              </form>
            </DialogContent>
          </Dialog>
          <LogoutButton variant="contained" color="secondary" onClick={handleLogOut}>Logout</LogoutButton>
        </APIProvider>
      </AppContainer>
    </ThemeProvider>
  );
};

export default CityCouncilBoard;
