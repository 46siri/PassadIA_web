import React, { useEffect, useRef, useState, useCallback } from "react";
import Axios from "axios";
import { Menu, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Button, Container, CssBaseline, Typography, Paper, ThemeProvider } from '@mui/material';
import { styled } from '@mui/system';
import CloseIcon from '@mui/icons-material/Close';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import FavoriteIcon from '@mui/icons-material/Favorite';
import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk';
import MapMarkerIcon from '@mui/icons-material/Place'; 
import { APIProvider, AdvancedMarker, Map, Pin } from '@vis.gl/react-google-maps'; 
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

const WalkerBoard = ({ onLogout }) => {
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
  useEffect(() => {
    // Clear any previous error/success messages and check if the location is a favorite
    setError(null);
    setSuccess(null);

    const checkFavoriteStatus = async () => {
      try {
        const response = await Axios.get("http://localhost:8080/favorites", {
          withCredentials: true,
        });

        // Check if the selected marker is already in the user's favorites
        if (
          response.data.favorites &&
          response.data.favorites.some(
            (favorite) => favorite.id === selectedMarker.id
          )
        ) {
          setIsFavorite(true); // Already a favorite
        } else {
          setIsFavorite(false); // Not a favorite yet
        }
      } catch (error) {
        console.error("Error checking favorite status:", error);
      }
    };

    if (selectedMarker) {
      checkFavoriteStatus();
    }
  }, [selectedMarker]);

  const handleFavoriteClick = async () => {
    setError(null);
    setSuccess(null);

    try {
      const response = await Axios.post(
        "http://localhost:8080/addFavorite",
        { locationId: selectedMarker.id },
        { withCredentials: true }
      );

      if (response.status === 200) {
        setSuccess("Marked as favorite!");
        setIsFavorite(true); // Mark as favorite after success
      }
    } catch (error) {
      if (error.response && error.response.status === 400) {
        setError("This location is already marked as favorite!");
      } else {
        setError("Failed to mark as favorite: " + error.message);
      }
    }
  };

  const handleStartWalkClick = async () => {
    setError(null);
    setSuccess(null);

    try {
        // Send the location ID and start date to the backend
        const response = await Axios.post(
            "http://localhost:8080/addHistory",
            { 
                locationId: selectedMarker.id, // Ensure selectedMarker contains the correct location ID
                startDate: new Date().toISOString() // Send the current date in ISO format
            },
            { withCredentials: true } // Allow the session to be sent with the request
        );

        if (response.status === 200) {
            setSuccess("Walk started!"); // Display success message
        }
    } catch (error) {
        setError("Failed to start walk: " + (error.response?.data?.error || error.message)); // Show a detailed error message
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
              {transformedMarkers.map((marker) => (
                <AdvancedMarker
                  key={marker.id}
                  position={marker.position}
                  clickable={true}
                  onClick={() => handleMarkerClick(marker)}
                >
                <Pin background={theme.palette.primary.secondary} borderColor={theme.palette.primary.main} glyphColor={theme.palette.primary.contrastText}
                   />
                </AdvancedMarker>
              ))}
            </Map>
          </APIProvider>
        </MapContainer>
 
        <Dialog
          open={selectedMarker !== null}
          onClose={handleCloseDialog}
          aria-labelledby="marker-details-title"
          fullWidth
        >
          <DialogTitle id="marker-details-title">
            {selectedMarker?.name}
            <IconButton aria-label="close" onClick={handleCloseDialog}>
              <CloseIcon />
            </IconButton>
          </DialogTitle >
          <DialogContent dividers>
            {selectedMarker?.primaryImage && (
              <img 
                src={imageMap[selectedMarker.id]} 
                alt={selectedMarker.name} 
                style={{ maxWidth: '100%', marginBottom: '20px' }} 
              />
            )}
            <Typography gutterBottom>
              District: {selectedMarker?.district}
            </Typography>
            <Typography gutterBottom>
              Region: {selectedMarker?.region}
            </Typography>
            <Typography gutterBottom>
              Description: {selectedMarker?.description}
            </Typography>
          </DialogContent>
          <DialogActions>
          <div>
            {!isFavorite ? (
              <Button
                variant="contained"
                color="primary"
                startIcon={<FavoriteIcon />}
                onClick={handleFavoriteClick}
              >
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
          <Button
              variant="contained"
              color="secondary"
              startIcon={<DirectionsWalkIcon />}
              //onClick={handleStartWalkClick}
          >
              Start Walk
          </Button>
          </DialogActions>
        </Dialog>
        <LogoutButton variant="contained" color="secondary" onClick={handleLogOut}>
          Logout
        </LogoutButton>
      </AppContainer>
    </ThemeProvider>
  );
};

export default WalkerBoard;
