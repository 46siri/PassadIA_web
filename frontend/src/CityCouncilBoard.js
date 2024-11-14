import React, { useEffect, useState, useRef, useCallback } from "react";
import Axios from "axios";
import {
  Menu, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions, Tabs, Tab, IconButton,
  Button, Container, CssBaseline, Typography, Paper, ThemeProvider, TextField, FormControl, FormLabel
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
  const handleMarkerClick = useCallback((marker) => setSelectedMarker(marker), []);

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

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    const keys = name.split('.');
    setFormData((prev) => {
      if (keys.length > 1) {
        return {
          ...prev,
          [keys[0]]: {
            ...prev[keys[0]],
            [keys[1]]: value,
          },
        };
      }
      return {
        ...prev,
        [name]: value,
      };
    });
  };

  const handleAddWalkway = async (e) => {
    e.preventDefault();

    const data = new FormData();
    data.append("id", formData.id);
    data.append("name", formData.name);
    data.append("description", formData.description);
    data.append("district", formData.district);
    data.append("region", formData.region);
    data.append("coordinates[latitude]", formData.coordinates.latitude);
    data.append("coordinates[longitude]", formData.coordinates.longitude);
    data.append("specifics[difficulty]", formData.specifics.difficulty);
    data.append("specifics[distance]", formData.specifics.distance);
    data.append("specifics[maxHeight]", formData.specifics.maxHeight);
    data.append("specifics[minHeight]", formData.specifics.minHeight);
    data.append("trajectory[start][latitude]", formData.trajectory.start.latitude);
    data.append("trajectory[start][longitude]", formData.trajectory.start.longitude);
    data.append("trajectory[end][latitude]", formData.trajectory.end.latitude);
    data.append("trajectory[end][longitude]", formData.trajectory.end.longitude);
    data.append("geojson", formData.geojson instanceof File ? formData.geojson : JSON.stringify(formData.geojson));
    data.append("primaryImage", formData.primaryImage);

    console.log("data:",data);
    try {
      await Axios.post("http://localhost:8080/addWalkway", data, {
        headers: { 'Content-Type': 'multipart/form-data' },
        withCredentials: true
      });
      setSuccess('Walkway added successfully!');
      setFormData({
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
      await Axios.post("http://localhost:8080/addWalkwayToMyList", { walkwayId: formData.id }, { withCredentials: true });
      setSuccess('Walkway added to my list successfully!');
      setError(null); // Clear any previous error message
    } catch (error) {
      setError('Failed to add walkway: ' + error.message);
      setSuccess(null);
    }
  };

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
            >
              {markers.map((marker) => (
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
            </DialogContent>
          </Dialog>
          <Button variant="contained" color="primary" onClick={() => setShowFormDialog(true)} style={{ marginTop: '20px' }}>
             Add New Walkway
          </Button>

          <Dialog open={showFormDialog} onClose={() => setShowFormDialog(false)} fullWidth>
            <DialogTitle>Add New Walkway</DialogTitle>
            <DialogContent>
              <form onSubmit={handleAddWalkway}>
              <TextField required label="ID" name="id" onChange={handleFormChange} fullWidth margin="normal" />
              <TextField required label="Name" name="name" onChange={handleFormChange} fullWidth margin="normal" />
              <TextField required label="Description" name="description" onChange={handleFormChange} fullWidth margin="normal" />
              
              <TextField
                required
                label="Latitude"
                name="coordinates.latitude"
                type="number"
                onChange={handleFormChange}
                fullWidth
                margin="normal"
                inputProps={{ min: -90, max: 90, step: "any" }}
              />
              
              <TextField
                required
                label="Longitude"
                name="coordinates.longitude"
                type="number"
                onChange={handleFormChange}
                fullWidth
                margin="normal"
                inputProps={{ min: -180, max: 180, step: "any" }}
              />

              <TextField required label="District" name="district" onChange={handleFormChange} fullWidth margin="normal" />
              
              <FormControl fullWidth margin="normal" variant="outlined" sx={{ border: '1px solid rgba(0, 0, 0, 0.23)', borderRadius: 1, padding: '8px' }}>
                <FormLabel>GeoJSON</FormLabel>
                <Button variant="outlined" size="small" onClick={() => setGeoJsonInputType(prev => (prev === 'text' ? 'file' : 'text'))}>
                  {geoJsonInputType === 'text' ? 'Switch to File Input' : 'Switch to Text Input'}
                </Button>
                {geoJsonInputType === 'text' ? (
                  <TextField required name="geojson" label="Enter GeoJSON" onChange={handleFormChange} fullWidth margin="normal" />
                ) : (
                  <input
                    required
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
                  required
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
              <TextField required label="Max Height" name="specifics.maxHeight" type="number" onChange={handleFormChange} fullWidth margin="normal" />
              <TextField required label="Min Height" name="specifics.minHeight" type="number" onChange={handleFormChange} fullWidth margin="normal" />
              
              <TextField
                required
                label="Start Latitude"
                name="trajectory.start.latitude"
                type="number"
                onChange={handleFormChange}
                fullWidth
                margin="normal"
                inputProps={{ min: -90, max: 90, step: "any" }}
              />
              
              <TextField
                required
                label="Start Longitude"
                name="trajectory.start.longitude"
                type="number"
                onChange={handleFormChange}
                fullWidth
                margin="normal"
                inputProps={{ min: -180, max: 180, step: "any" }}
              />
              
              <TextField
                required
                label="End Latitude"
                name="trajectory.end.latitude"
                type="number"
                onChange={handleFormChange}
                fullWidth
                margin="normal"
                inputProps={{ min: -90, max: 90, step: "any" }}
              />
              
              <TextField
                required
                label="End Longitude"
                name="trajectory.end.longitude"
                type="number"
                onChange={handleFormChange}
                fullWidth
                margin="normal"
                inputProps={{ min: -180, max: 180, step: "any" }}
              />

              <Button type="submit" variant="contained" color="primary">Submit</Button>
            </form>

            </DialogContent>
            <DialogActions>
              <Button onClick={() => setShowFormDialog(false)} color="secondary">Cancel</Button>
            </DialogActions>
          </Dialog>

          <LogoutButton variant="contained" color="secondary" onClick={handleLogOut}>Logout</LogoutButton>
        </APIProvider>
      </AppContainer>
    </ThemeProvider>
  );
};

export default CityCouncilBoard;
