import React, { useEffect, useState } from "react";
import Axios from "axios";
import { Avatar, Button, Container, CssBaseline, IconButton, Typography, Menu, MenuItem, Grid2, CircularProgress, TextField, Card, CardContent, Paper, ThemeProvider } from '@mui/material';
import { styled, textAlign } from '@mui/system';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/Edit';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import EmailIcon from '@mui/icons-material/Email';
import WorkIcon from '@mui/icons-material/Work';
import CakeIcon from '@mui/icons-material/Cake';
import HeightIcon from '@mui/icons-material/Height';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import FavoriteIcon from '@mui/icons-material/Favorite';
import InfoIcon from '@mui/icons-material/Info';
import { useNavigate } from 'react-router-dom';

import theme from './Theme/theme';
import logo from './Theme/images/baselogo.jpg';
import WalkerBoard from "./WalkerBoard";

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
const GridContainer = styled(Grid2)(({ theme }) => ({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(50),
}));
const GridItem = styled(Grid2)(({ theme }) => ({
    display: 'vertical',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(5),
    marginLeft: theme.spacing(5),
    marginRight: theme.spacing(5),
}));


const ProfileModal = ({ onLogout }) => {
    const [profileData, setProfileData] = useState(null);
    const [email, setEmail] = useState('');
    const [userId, setUserId] = useState('');
    const [name, setName] = useState('');
    const [role, setRole] = useState('');
    const [birthdate, setBirthdate] = useState('');
    const [height, setHeight] = useState('');
    const [weight, setWeight] = useState('');
    const [interests, setInterests] = useState('');
    const [bio, setBio] = useState('');
    const [avatarURL, setAvatarURL] = useState('');
    const [error, setError] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [anchorEl, setAnchorEl] = useState(null);
    const [success, setSuccess] = useState(null);
    const [uploading, setUploading] = useState(false);

    const navigate = useNavigate();

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
        if (role === 'Walker') {
            navigate('/WalkerBoard');
        } else if (role === 'Merchant') {
            navigate('/MerchantBoard');
        } else if (role === 'City ​​Council') {
            navigate('/City​CouncilBoard');
        } else {
            console.log('Role not found');
            navigate('/App');
        }

    };

    const handleEditToggle = () => {
        setIsEditing(!isEditing);
    };

    useEffect(() => {
        const fetchProfileData = async () => {
            try {
                const response = await Axios.post('http://localhost:8080/profileData', {}, { withCredentials: true });
                setProfileData(response.data);
                setEmail(response.data.email);
                setName(response.data.name);
                setRole(response.data.role);
                setBirthdate(response.data.birthdate);
                setHeight(response.data.height);
                setWeight(response.data.weight);
                setInterests(response.data.interests);
                setBio(response.data.bio);
                setAvatarURL(response.data.avatarURL);
            } catch (error) {
                setError('Error fetching profile data. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        fetchProfileData();
    }, []);

    const handleSaveProfile = async () => {
        setLoading(true);
        setError(null);

        try {
            // Send the updated profile data to the backend
            const response = await Axios.post('http://localhost:8080/updateProfile', {
                email,       // Already fetched from state
                userId,
                name,        // Updated name
                role,        // Updated role
                birthdate,   // Updated birthdate
                height,      // Updated height
                weight,      // Updated weight
                interests,   // Updated interests
                bio,         // Updated bio
            });

            if (response.status === 200) {
                setIsEditing(false);
                setSuccess('Profile updated successfully!');
            }
        } catch (error) {
            setError('Error updating profile: ' + error.message);
        } finally {
            setLoading(false);
        }
    };
    const handleChangePhoto = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await Axios.post('http://localhost:8080/changePhoto', {
                email,
                avatarURL,
            });
            if (response.status === 200) {
                setSuccess('Photo updated successfully!');
            }
        }
        catch (error) {
            setError('Error updating photo: ' + error.message);
        }
        finally {
            setLoading(false);
        }
    };


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
                <MenuItem onClick={() => { handleClose(); navigate('/History'); }}>
                History
                </MenuItem>
                <MenuItem onClick={() => { handleClose(); navigate('/Favorites'); }}>
                Favorites
                </MenuItem>
            </Menu>

            <Grid2>
                    {/* Avatar Section */}
                    <Grid2 item xs={12} sm={5} style={{textAlign: 'center'}} marginBottom={10}>
                            <Typography variant="h4" gutterBottom>{name}</Typography>
                            <AvatarStyled src={avatarURL}/>
                                <input
                                accept="image/*"
                                style={{ display: 'none' }}
                                id="avatar-upload"
                                type="file"
                                //onChange={handleEditAvatar}
                                />
                                <label htmlFor="avatar-upload">
                            <Button variant="contained" color="primary" style={{ marginTop: '1rem' }} onClick={handleChangePhoto}>
                                Change Photo
                            </Button>
                                </label>
                                {uploading && <CircularProgress />}
                    </Grid2>
                    {/* Profile Information Section */}
                    <Grid2 container spacing={2}>
                        <CardStyled>
                            {isEditing ? (
                                <>
                                    <FormField fullWidth label="Edit Name" value={name} onChange={(e) => setName(e.target.value)} />
                                    <FormField fullWidth label="Edit Role" value={role} onChange={(e) => setRole(e.target.value)} />
                                    <FormField fullWidth label="Edit Birthdate" value={birthdate} onChange={(e) => setBirthdate(e.target.value)} />
                                    <FormField fullWidth label="Edit Height (cm)" value={height} onChange={(e) => setHeight(e.target.value)} />
                                    <FormField fullWidth label="Edit Weight (Kg)" value={weight} onChange={(e) => setWeight(e.target.value)} />
                                    <FormField fullWidth label="Edit Interests" value={interests} onChange={(e) => setInterests(e.target.value)} />
                                    <FormField fullWidth label="Edit Bio" value={bio} onChange={(e) => setBio(e.target.value)} />
                                    <EditButtonRight variant="contained" color="primary" onClick={handleSaveProfile}>Save Profile</EditButtonRight>
                                    <EditButtonRight variant="contained" color="secondary" onClick={handleEditToggle}>Cancel</EditButtonRight>
                                </>
                            ) : (
                                <CardContent>
                                    <Grid2 container spacing={2} size={12}>
                                        {/* Left Column */}
                                        <GridItem item xs={12} sm={6}>
                                            <Typography variant="body1">
                                                <AccountCircleIcon/> <strong>User Id:</strong> {userId}
                                            </Typography>
                                            <Typography variant="body1">
                                                <EmailIcon /> <strong>Email:</strong> {email}
                                            </Typography>
                                            <Typography variant="body1">
                                                <CakeIcon /> <strong>Birthdate:</strong> {birthdate}
                                            </Typography>
                                            <Typography variant="body1">
                                                <FitnessCenterIcon /> <strong>Weight (kg):</strong> {weight}
                                            </Typography>
                                            <Typography variant="body1">
                                                <InfoIcon /> <strong>Bio:</strong> {bio}
                                            </Typography>
                                        </GridItem>

                                        {/* Right Column */}
                                        <GridItem item xs={12} sm={6}>
                                            <Typography variant="body1">
                                                <AccountCircleIcon /> <strong>Name:</strong> {name}
                                            </Typography>
                                            <Typography variant="body1">
                                                <WorkIcon /> <strong>Role:</strong> {role}
                                            </Typography>
                                            <Typography variant="body1">
                                                <HeightIcon /> <strong>Height (cm):</strong> {height}
                                            </Typography>
                                            <Typography variant="body1">
                                                <FavoriteIcon /> <strong>Interests:</strong> {interests}
                                            </Typography>
                                        </GridItem>
                                        </Grid2>
                                        <EditButtonRight variant="contained" color="primary" startIcon={<EditIcon />} onClick={handleEditToggle}>
                                            Edit Profile
                                        </EditButtonRight>
                                    </CardContent>
                                )}
                            </CardStyled>
                        </Grid2>
                </Grid2>

                <LogoutButton variant="contained" color="secondary" onClick={handleLogOut}>
                    Logout
                </LogoutButton>
            </AppContainer>
        </ThemeProvider>
    );
};

export default ProfileModal;
