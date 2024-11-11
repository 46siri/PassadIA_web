import React, { useEffect, useState } from "react";
import Axios from "axios";
import { Avatar, Button, Container, CssBaseline, IconButton, Typography, Menu, MenuItem, Grid2, CircularProgress, TextField, Card, CardContent, Paper, ThemeProvider } from '@mui/material';
import { styled, textAlign } from '@mui/system';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import FavoriteIcon from '@mui/icons-material/Favorite';
import { useNavigate } from 'react-router-dom';

import theme from './Theme/theme';
import logo from './Theme/images/baselogo.jpg';
import walkway0 from './Theme/images/walkway_0.jpg';
import walkway1 from './Theme/images/walkway_1.jpg';
import walkway2 from './Theme/images/walkway_2.jpg';
import walkway3 from './Theme/images/walkway_3.jpg';

// Styled components using MUI's new styled API
export const AppContainer = styled(Container)(({ theme }) => ({
    ...theme.root,
    zIndex: 9999,
    backgroundColor: '#f5f5f5',
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }));

export const Logo = styled('img')(({ theme }) => ({
    position: 'absolute',
    top: theme.spacing(2),
    left: theme.spacing(50),
    width: '200px',
    height: 'auto',
}));


export const AvatarStyled = styled(Avatar)(({ theme }) => ({
    height: theme.spacing(50),
    width: theme.spacing(50),
    margin: '0 auto',
}));

export const FormField = styled(TextField)(({ theme }) => ({
    marginBottom: theme.spacing(2),
    display: 'flex',
    width: '100%', // Ensures the form field takes the full width of its container
    maxWidth: '500px', // Set a maximum width to make the form smaller on larger screens
    alignSelf: 'center', // Centers the form field horizontally
}));


export const ProfileCard = styled('div')(({ theme }) => ({
    padding: theme.spacing(2),
    borderRadius: theme.spacing(2),
    boxShadow: '0px 5px 15px rgba(0, 0, 0, 0.1)',
    backgroundColor: '#ffffff',
}));

export const EditButton = styled(Button)(({ theme }) => ({
    marginTop: theme.spacing(2),
}));

export const CardStyled = styled(Card)(({ theme }) => ({
    marginBottom: theme.spacing(5),
    marginLeft: theme.spacing(15),
    padding: theme.spacing(5),
    backgroundColor: '#f9f9f9',
    boxShadow: '0px 3px 15px rgba(0, 0, 0, 0.1)',
    borderRadius: theme.spacing(1),
}));

export const IconStyled = styled('span')(({ theme }) => ({
    verticalAlign: 'middle',
    marginRight: theme.spacing(1),
    color: theme.palette.primary.main,
}));

export const TextStyled = styled('span')(({ theme }) => ({
    verticalAlign: 'middle',
}));

export const EditButtonRight = styled(Button)(({ theme }) => ({
    marginTop: theme.spacing(5),
    marginLeft: theme.spacing(120),
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

const History = ({ onLogout }) => {
    const [visitedLocations, setVisitedLocations] = useState(null);
    const [error, setError] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [anchorEl, setAnchorEl] = useState(null);
    const [success, setSuccess] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [role, setRole] = useState(null);

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
        const fetchRole = async () => {
            try {
                const response = await Axios.post('http://localhost:8080/profileData', {}, { withCredentials: true });
                setRole(response.data.role);
            } catch (error) {
                setError('Error fetching profile data. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        fetchRole();
    }, []);

    useEffect(() => {
        const fetchVisitedLocations = async () => {
            try {
                // Fetch history from the backend
                const response = await Axios.get('http://localhost:8080/history');
                
                // Check if response contains the history data
                if (response.status === 200 && response.data.history) {
                    setVisitedLocations(response.data.history); // Use the 'history' field from the backend response
                } else {
                    setVisitedLocations([]); // Set empty if no history is found
                }
            } catch (error) {
                console.error('Error fetching visited locations:', error);
            }
        };
    
        fetchVisitedLocations(); // Fetch the visited locations when the component mounts
    }, []);
    

    if (loading) {
        return <CircularProgress />;
    }

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
                <MenuItem onClick={() => { handleClose(); handleLogoClick(); }}>
                Dashboard
                </MenuItem>
                <MenuItem onClick={() => { handleClose(); navigate('/Profile'); }}>
                Profile
                </MenuItem>
                <MenuItem onClick={() => { handleClose(); navigate('/Favorites'); }}>
                Favorites
                </MenuItem>
            </Menu>
            <Grid2 container spacing={2} style={{ marginTop: '120px' }} columns={16}>
                {visitedLocations && visitedLocations.length > 0 ? (
                    visitedLocations.map((location) => (
                        <Grid2 item xs={12} sm={6} md={4} key={location.id}>
                            <CardStyled>
                                <CardContent>
                                <Typography variant="h6" component="h2">
                                    {location.name}
                                </Typography>
                                <Typography variant="body2" color="p">
                                    Walk started on: {new Date(location.startDate).toLocaleDateString()}
                                </Typography>
                                </CardContent>
                            </CardStyled>
                        </Grid2>
                    ))            
                    ) : (
                    <Grid2 item xs={12}>
                        <Typography variant="h6" color="textSecondary" align="center">
                            No visited locations found.
                        </Typography>
                    </Grid2>
                )}
            </Grid2>
            <LogoutButton variant="contained" color="secondary" onClick={handleLogOut}>
                Logout
            </LogoutButton>
        </AppContainer>
    </ThemeProvider>
    );
};

export default History;
