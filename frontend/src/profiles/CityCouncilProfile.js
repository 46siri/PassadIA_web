import React, { useEffect, useState } from "react";
import Axios from "axios";
import { Avatar, Button, Container, CssBaseline, IconButton,Select, InputLabel,FormControl,FormControlLabel, Typography, Checkbox, Menu, MenuItem, Grid2, CircularProgress, TextField, Card, CardContent, Paper, ThemeProvider } from '@mui/material';
import { styled, textAlign } from '@mui/system';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/Edit';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import EmailIcon from '@mui/icons-material/Email';
import WorkIcon from '@mui/icons-material/Work';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import BusinessCenterIcon from '@mui/icons-material/BusinessCenter';

import { useNavigate } from 'react-router-dom';

import theme from '../Theme/theme';
import logo from '../Theme/images/baselogo.jpg';

export const AppContainer = styled(Container)(({ theme }) => ({
    ...theme.root,
    zIndex: 9999,
    backgroundColor: '#ffffff', 
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column', 
    paddingTop: theme.spacing(4),
  }));

export const Logo = styled('img')(({ theme }) => ({
    position: 'absolute',
    top: theme.spacing(2),
    left: theme.spacing(50),
    width: '200px',
    height: 'auto',
}));

export const LevelContainer = styled(Container)(({ theme }) => ({
    position: 'absolute',
    top: theme.spacing(60),
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
    width: '100%',
    maxWidth: '500px',
    alignSelf: 'center',
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
    marginLeft: 'auto',
    marginRight: 'auto',
    padding: theme.spacing(5),
    backgroundColor: '#f9f9f9',
    boxShadow: '0px 3px 15px rgba(0, 0, 0, 0.1)',
    borderRadius: theme.spacing(1),
    maxWidth: '800px',
    textAlign: 'left',
}));


export const IconStyled = styled('span')(({ theme }) => ({
    verticalAlign: 'middle',
    marginRight: theme.spacing(1),
    color: theme.palette.primary.main,
}));

const SelectStyled = styled(Select)({
    ...theme.forms.select,
});

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

const CityCouncilProfile = ({ onLogout }) => {
    const [profileData, setProfileData] = useState(null);
    const [email, setEmail] = useState('');
    const [userId, setUserId] = useState('');
    const [role, setRole] = useState('');
    const [institutionName, setInstitutionName] = useState('');
    const [registrationDate, setRegistrationDate] = useState('');
    const [positionType, setPositionType] = useState('');
    const [location, setLocation] = useState('');

    const [avatarURL, setAvatarURL] = useState('');
    const [error, setError] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [anchorEl, setAnchorEl] = useState(null);
    const [success, setSuccess] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [showChangePhoto, setShowChangePhoto] = useState(false); 
    const [avatarFile, setAvatarFile] = useState(null);
    

    const navigate = useNavigate();

    const handleLogOut = async () => {
        setError(null);
        setSuccess(null);

        try {
            await Axios.get("http://localhost:8080/logout",{
                withCredentials: true
              });
            if (onLogout) {
                onLogout();
            }

            setSuccess('Log out successful!');
            navigate('/App');
        } catch (error) {
            setError('Log out failed: ' + error.message);
        }
    };

    const handleLogoClick = () => {
        navigate('/CityCouncilBoard');

    };

    const handleClick = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
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
                setInstitutionName(response.data.institutionName);
                setRole(response.data.role);
                setRegistrationDate(response.data.registrationDate);
                setPositionType(response.data.positionType);
                setLocation(response.data.location);
                setUserId(response.data.userId);
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
            const response = await Axios.post('http://localhost:8080/updateCityCouncilProfile', {
                email,
                userId,
                institutionName,
                role,
                registrationDate,
                positionType,
                location,      
            },{
                withCredentials: true
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


    const handleChangePhoto = async (avatarFile) => {
        console.log("handleChangePhoto called");
        if (!avatarFile) {
            setError("No file selected.");
            return;
        }
    
        const formData = new FormData();
        formData.append("avatar", avatarFile);
    
        setUploading(true);
        setError(null);
        try {
            const response = await Axios.post("http://localhost:8080/changePhoto", formData, {
                headers: { "Content-Type": "multipart/form-data" },
                withCredentials: true
            });
    
            if (response.status === 200) {
                const newAvatarURL = response.data.avatarURL;
                setAvatarURL(newAvatarURL); 
                setProfileData((prev) => ({
                    ...prev,
                    avatarURL: newAvatarURL,
                })); 
    
                setAvatarFile(null); 
                setSuccess("Photo updated successfully!");
            }
        } catch (error) {
            setError("Error updating photo: " + error.message);
        } finally {
            setUploading(false);
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
                <MenuItem onClick={() => { handleClose(); navigate('/MyWalkways'); }}>
                My Walkways
                </MenuItem>
            </Menu>

            <Grid2>
                <Grid2 item xs={12} sm={5} style={{ textAlign: 'center' }} marginBottom={10}>
                    <Typography variant="h4" gutterBottom>{institutionName}</Typography>
                    <label htmlFor="avatar-upload">
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                            <AvatarStyled
                                src={avatarURL}
                                onClick={() => document.getElementById('avatar-upload').click()} 
                                onMouseEnter={() => setShowChangePhoto(true)} 
                                onMouseLeave={() => setShowChangePhoto(false)}
                                style={{ 
                                    cursor: 'pointer',
                                    opacity: uploading ? 0.5 : 1, 
                                    transition: 'opacity 0.3s',
                                }}
                            />
                            {showChangePhoto && !uploading && (
                                <Button
                                    variant="contained"
                                    size="small"
                                    onClick={() => document.getElementById('avatar-upload').click()}
                                    style={{
                                        position: 'absolute',
                                        top: '50%',
                                        left: '50%',
                                        transform: 'translate(-50%, -50%)',
                                        opacity: 0.9,
                                        backgroundColor: '#ffffff',
                                        color: '#000000',
                                    }}
                                >
                                    Change Photo
                                </Button>
                            )}
                            {uploading && (
                                <CircularProgress
                                    size={60}
                                    style={{
                                        position: 'absolute',
                                        top: '50%',
                                        left: '50%',
                                        marginTop: -30,
                                        marginLeft: -30,
                                    }}
                                />
                            )}
                        </div>

                        <input
                            accept="image/*"
                            style={{ display: 'none' }}
                            id="avatar-upload"
                            type="file"
                            onChange={(e) => {
                                const file = e.target.files[0];
                                if (file) {
                                    handleChangePhoto(file); 
                                }
                            }}
                        />
                    </label>
                </Grid2>


                <Grid2 container spacing={2}>
                    <CardStyled>
                        {isEditing ? (
                            <>
                                <FormField fullWidth label="Nome da Instituição" value={institutionName} onChange={(e) => setInstitutionName(e.target.value)} />
                                <FormField fullWidth label="Data de Registo" value={registrationDate} onChange={(e) => setRegistrationDate(e.target.value)} />
                                <FormField fullWidth label="Cargo (CM/JF)" value={positionType} onChange={(e) => setPositionType(e.target.value)} />
                                <FormField fullWidth label="Localidade" value={location} onChange={(e) => setLocation(e.target.value)} />
                                <FormField fullWidth label="Edit ID" value={userId} onChange={(e) => setUserId(e.target.value)} />
                                <EditButtonRight variant="contained" color="primary" onClick={handleSaveProfile}>Save Profile</EditButtonRight>
                                <EditButtonRight variant="contained" color="secondary" onClick={handleEditToggle}>Cancel</EditButtonRight>
                            </>
                        ) : (
                            <CardContent>
                                <Grid2 container spacing={2} size={12}>
                                    <Grid2 item xs={12} sm={6}>
                                        <Typography variant="body1">
                                            <AccountCircleIcon/> <strong>Institution Id:</strong> {userId}
                                        </Typography>
                                        <Typography variant="body1">
                                            <EmailIcon /> <strong>Email:</strong> {email}
                                        </Typography>
                                        <Typography variant="body1">
                                            <CalendarMonthIcon /> <strong>Registration Date:</strong> {registrationDate}
                                        </Typography>
                                        <Typography variant="body1">
                                            <LocationOnIcon /> <strong>Location:</strong> {location}
                                        </Typography>

                                    </Grid2>

                                    <Grid2 item xs={12} sm={6}>
                                        <Typography variant="body1">
                                            <AccountCircleIcon /> <strong>Name of Institution:</strong> {institutionName}
                                        </Typography>
                                        <Typography variant="body1">
                                            <BusinessCenterIcon /> <strong>Position Type:</strong> {positionType}
                                        </Typography>
                                        <Typography variant="body1">
                                            <WorkIcon /> <strong>Role:</strong> {role}
                                        </Typography>
                                    </Grid2>
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

export default CityCouncilProfile;
