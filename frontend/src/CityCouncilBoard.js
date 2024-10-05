import React, { useEffect, useState } from "react";
import Axios from "axios";
import { Menu, MenuItem, Dialog, DialogContent, IconButton, Button, Container,DialogTitle, CssBaseline, Typography, Paper, ThemeProvider } from '@mui/material';
import { styled } from '@mui/system';
import MapMarkerIcon from '@mui/icons-material/Place';
import CloseIcon from '@mui/icons-material/Close';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';
import { useNavigate } from 'react-router-dom';

import theme from './Theme/theme';
import logo from './Theme/images/baselogo.jpg';
import walkway0 from './Theme/images/walkway_0.jpg';
import walkway1 from './Theme/images/walkway_1.jpg';
import walkway2 from './Theme/images/walkway_2.jpg';
import walkway3 from './Theme/images/walkway_3.jpg';

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
  height: '600px',
  width: '100%',
  marginTop: theme.spacing(4),
}));

const MarkerIconContainer = styled('div')(({ theme }) => ({
  flexDirection: 'row',
  background: theme.palette.background.default,
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '50%',
  padding: 6,
  boxShadow: theme.shadows[5],
}));

const MarkerText = styled(Typography)(({ theme }) => ({
  fontSize: 10,
  color: theme.palette.primary.main,
  fontWeight: 'bold',
}));

const LogoutButton = styled(Button)(({ theme }) => ({
  position: 'absolute',
  right: 100,
  top: 20,
}));

const MoreMenuButton = styled(IconButton)(({ theme }) => ({
  position: 'absolute',
  right: 20,
  top: 20,
}));

const DialogTitleContainer = styled('div')({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
});

const CityCouncilBoard = ({ onLogout }) => {
  const [error, setError] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [success, setSuccess] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const navigate = useNavigate();
  const imageMap = {
    0: walkway0,
    1: walkway1,
    2: walkway2,
    3: walkway3,
  };

  // Handle Logout
  const handleLogOut = async () => {
    setError(null);
    setSuccess(null);

    try {
      await Axios.get("http://localhost:8080/logout");
      if (onLogout) {
        onLogout();
      }

      setSuccess('Log out successful!');
      navigate('/App');
    } catch (error) {
      setError('Log out failed: ' + error.message);
    }
  };

  const mapStyles = {
    height: '100%',
    width: '100%',
  };
  // Menu Handlers 
  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogoClick = () => {
    navigate('/WalkerBoard');
  };

  useEffect(() => {
    const fetchMarkers = async () => {
      try {
        const response = await Axios.get("http://localhost:8080/markers"); // Call backend endpoint
        setMarkers(response.data); // Update state with fetched markers
      } catch (error) {
        console.error("Error fetching markers:", error);
        setError("Error fetching markers.");
      }
    };

    fetchMarkers();
  }, []);

  const handleCloseDialog = () => {
    setSelectedMarker(null);
  };  

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppContainer>
        <Logo src={logo} alt="logo" onClick={handleLogoClick} />
        
        {/* 3-dot Menu */}
        <MoreMenuButton
          aria-label="more"
          aria-controls="long-menu"
          aria-haspopup="true"
          onClick={handleClick}
        >
        <MoreVertIcon />
        </MoreMenuButton>
        {/* Menu Component */}
        <Menu
        id="long-menu"
        anchorEl={anchorEl}
        keepMounted
        open={Boolean(anchorEl)}
        onClose={handleClose}
        slotProps={{
            paper: {
            style: {
                maxHeight: 48 * 4.5,
                width: '20ch',
            },
            },
        }}
        >
        <MenuItem onClick={() => { handleClose(); navigate('/Profile'); }}>
            Profile
        </MenuItem>
        <MenuItem onClick={() => { handleClose(); navigate('/History'); }}>
            History
        </MenuItem>
        <MenuItem onClick={() => { handleClose(); navigate('/Settings'); }}>
            Settings
        </MenuItem>
        </Menu>
        {/* Google Map */}
        <MapContainer>
          <LoadScript googleMapsApiKey="AIzaSyC8Sj12_rv73anPhi2oCeqsVVjUkfFJ4-U">
          <GoogleMap
            mapContainerStyle={mapStyles}
            zoom={10}
            center={{ lat: 41.5564, lng: -8.16415 }}
            mapTypeId="terrain" 
            >
            {/* Display markers */}
              {markers.map((marker) => (
                <Marker
                  key={marker.id}
                  position={{ lat: marker.coordinates.latitude, lng: marker.coordinates.longitude }}
                  title={marker.name}
                  onClick={() => setSelectedMarker(marker)}
                />
              ))}
            </GoogleMap>
          </LoadScript>
        </MapContainer>
        {/* Marker Dialog */}
        <Dialog
          open={selectedMarker !== null}
          onClose={handleCloseDialog}
          aria-labelledby="marker-details-title"
          fullWidth
        >
          <DialogTitleContainer>
            <Typography>{selectedMarker?.name}</Typography>
            <IconButton aria-label="close" onClick={handleCloseDialog}>
              <CloseIcon />
            </IconButton>
          </DialogTitleContainer>
          <DialogContent dividers>
            {selectedMarker?.primaryImage && (
              <img
                src={imageMap[selectedMarker.id]}
                alt={selectedMarker.name}
                style={{ maxWidth: '100%', marginBottom: '20px' }}
              />
            )}
            <Typography gutterBottom>District: {selectedMarker?.district}</Typography>
            <Typography gutterBottom>Region: {selectedMarker?.region}</Typography>
            <Typography gutterBottom>Description: {selectedMarker?.description}</Typography>
          </DialogContent>
        </Dialog>
        {/* Logout Button */}
        <LogoutButton variant="contained" color="secondary" onClick={handleLogOut}>
          Logout
        </LogoutButton>
      </AppContainer>
    </ThemeProvider>
  );
};

export default CityCouncilBoard;
