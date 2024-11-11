import React, { useEffect, useRef, useState, useCallback } from "react";
import Axios from "axios";
import { Menu, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Button, Container, CssBaseline, Typography, Paper, ThemeProvider } from '@mui/material';
import { styled } from '@mui/system';
import CloseIcon from '@mui/icons-material/Close';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import FavoriteIcon from '@mui/icons-material/Favorite';
import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk';
import MapMarkerIcon from '@mui/icons-material/Place'; 
import { APIProvider, AdvancedMarker, Map } from '@vis.gl/react-google-maps'; 
import { useNavigate } from 'react-router-dom';

import theme from './Theme/theme';
import logo from './Theme/images/baselogo.jpg';
import walkway0 from './Theme/images/walkway_0.jpg';
import walkway1 from './Theme/images/walkway_1.jpg';
import walkway2 from './Theme/images/walkway_2.jpg';
import walkway3 from './Theme/images/walkway_3.jpg';
/* global google */

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

const MarkerStyled = styled(AdvancedMarker)(({ theme }) => ({
  flexDirection: 'row', 
    background: theme.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 150,
    padding: 6,
    elevation: 5
}));

const MarkerText = styled(Typography)(({ theme }) => ({
  fontSize: 10,
  color: theme.palette.primary,
  fontWeight: 'bold',
}));

const StartWalk = ({ onLogout }) => {
  const [error, setError] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [success, setSuccess] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const mapRef = useRef(null);



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

  const handleStopWalkClick = async () => {
    //stop the walk, send the data and hour of stop to the backend
    setError(null);
    setSuccess(null);

    try {
        const response = await Axios.post(
            "http://localhost:8080/stopWalk",
            { 
                locationId: selectedMarker.id, 
                stopDate: new Date().toISOString(), 
            },
            { withCredentials: true }
        );
    
        if (response.status === 200) {
            setSuccess("Walk stopped successfully!");
            setIsFavorite(true); // Mark as favorite after success
        }
        }
        catch (error) {
            if (error.response && error.response.status === 400) {
                setError("This location is already marked as favorite!");
            } else {
                setError("Failed to stop walk: " + error.message);
            }
        }
};



  const mapStyles = {
    height: '100%',
    width: '100%',
  };

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogoClick = () => {
    navigate('/WalkerBoard');
  };

  const handleCloseDialog = () => {
    setSelectedMarker(null);
  };
  const handleMarkerClick = useCallback((marker) => {
    setSelectedMarker(marker);
  }, []); 
  
  
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
      district: marker.district || 'Unknown District'
  }));


  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppContainer>
        <Logo src={logo} alt="logo" onClick={handleLogoClick} />
        
        <MoreMenuButton
          aria-label="more"
          aria-controls="long-menu"
          aria-haspopup="true"
          onClick={handleClick}
        >
        <MoreVertIcon />
        </MoreMenuButton>

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
          <MenuItem onClick={() => { handleClose(); navigate('/Favorites'); }}>
            Favorites
          </MenuItem>
        </Menu>

        <MapContainer>
          <APIProvider 
            apiKey={'AIzaSyC8Sj12_rv73anPhi2oCeqsVVjUkfFJ4-U'} onLoad={() => console.log('Maps API has loaded.')}>
            <Map
              defaultZoom={10}
              defaultCenter={{ lat: 41.5564, lng: -8.16415 }}
              mapId='5f6b01e0c09b0450'
              mapTypeId="terrain" 
            > 
            </Map>
          </APIProvider>
        </MapContainer>  
        <Button
          variant="contained"
          color="primary"
          onClick={handleStopWalkClick}
        >
            Stop Walk
        </Button>              
        <LogoutButton variant="contained" color="secondary" onClick={handleLogOut}>
          Logout
        </LogoutButton>
      </AppContainer>
    </ThemeProvider>
  );
};

export default StartWalk;
