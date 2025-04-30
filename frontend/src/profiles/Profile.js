import React, { useEffect, useState } from "react";
import Axios from "axios";
import { Avatar, Button, Container, CssBaseline, IconButton,Select, InputLabel,FormControl,FormControlLabel, Typography, Checkbox, Menu, MenuItem, Grid2, CircularProgress, TextField, Card, CardContent, Paper, ThemeProvider } from '@mui/material';
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
  
export const DeleteButton = styled(Button)(({ theme }) => ({
    marginTop: theme.spacing(5),
    marginRight: theme.spacing(110),
    backgroundColor: theme.palette.common.white,
    color:theme.palette.error.main,
    '&:hover': {
        backgroundColor: theme.palette.error.dark,
        color:theme.palette.common.white,
    },
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

const SelectStyled = styled(Select)({
    ...theme.forms.select,
});

export const TextStyled = styled('span')(({ theme }) => ({
    verticalAlign: 'middle',
}));

export const EditButtonRight = styled(Button)(({ theme }) => ({
    marginTop: theme.spacing(7),
    marginLeft: theme.spacing(100),
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

const ProfileModal = ({ onLogout }) => {
    const [profileData, setProfileData] = useState(null);
    const [email, setEmail] = useState('');
    const [userId, setUserId] = useState('');
    const [name, setName] = useState('');
    const [role, setRole] = useState('');
    const [birthdate, setBirthdate] = useState('');
    const [height, setHeight] = useState('');
    const [weight, setWeight] = useState('');
    const [bio, setBio] = useState('');
    const [avatarURL, setAvatarURL] = useState('');
    const [error, setError] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [anchorEl, setAnchorEl] = useState(null);
    const [success, setSuccess] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [interestsList, setInterestsList] = useState([]); 
    const [selectedInterests, setSelectedInterests] = useState([]); 
    const [showChangePhoto, setShowChangePhoto] = useState(false); 
    const [points, setPoints] = useState(0);
    const [level, setLevel] = useState([]);
    const [avatarFile, setAvatarFile] = useState(null);


    const navigate = useNavigate();

    const handleLogOut = async () => {
        setError(null);
        setSuccess(null);

        try {
            await Axios.get("http://localhost:8080/logout", { withCredentials: true });
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
        navigate('/WalkerBoard');

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
                setUserId(response.data.userId);
                setEmail(response.data.email);
                setName(response.data.name);
                setRole(response.data.role);
                setBirthdate(response.data.birthdate);
                setHeight(response.data.height);
                setWeight(response.data.weight);
                setBio(response.data.bio);
                setAvatarURL(response.data.avatarURL);
                setSelectedInterests(Array.isArray(response.data.interests) ? response.data.interests : []); // Garantir que é array
                const interestsResponse = await Axios.get('http://localhost:8080/interests',{
                    withCredentials: true
                  });
                setInterestsList(interestsResponse.data);
                const pointsResponse = await Axios.get('http://localhost:8080/points',{
                    withCredentials: true
                  });
                setPoints(pointsResponse.data);
                console.log('Points:', pointsResponse.data);
                const levelResponse = await Axios.get('http://localhost:8080/level',{
                    withCredentials: true
                  });
                setLevel(levelResponse.data);
                console.log('Level:', levelResponse.data);
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
            const response = await Axios.post('http://localhost:8080/updateWalkerProfile', {
                email,       
                userId,
                name,        
                role,        
                birthdate,   
                height,      
                weight,      
                bio,         
                interests: selectedInterests,
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
    
    
          
    const handleDeleteAccount = async () => {
        try {
            if (!window.confirm("Are you sure you want to delete your account? This action is irreversible.")) {
                return;
            }
    
            await Axios.post("http://localhost:8080/deleteAccount", {}, { withCredentials: true });
            alert("Your account has been deleted.");
            navigate("/App"); 
        } catch (error) {
            alert("Failed to delete account: " + error.message);
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
            <LevelContainer>
            <Typography variant="body1" style={{ marginTop: '10px' }}>
                🏅 <strong>Level:</strong> {level.level}
            </Typography>
            <Typography variant="body1">
                ⭐ <strong>Points:</strong> {points.points}
            </Typography>
            </LevelContainer>
            
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
                <Grid2 item xs={12} sm={5} style={{ textAlign: 'center' }} marginBottom={10}>
                    <Typography variant="h4" gutterBottom>{name}</Typography>
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
                                <FormField fullWidth label="Edit Name" value={name} onChange={(e) => setName(e.target.value)} />
                                <FormField fullWidth label="Edit ID" value={userId} onChange={(e) => setUserId(e.target.value)} />
                                <FormField fullWidth label="Edit Birthdate" value={birthdate} onChange={(e) => setBirthdate(e.target.value)} />
                                <FormField fullWidth label="Edit Height (cm)" value={height} onChange={(e) => setHeight(e.target.value)} />
                                <FormField fullWidth label="Edit Weight (Kg)" value={weight} onChange={(e) => setWeight(e.target.value)} />
                                <FormField fullWidth label="Edit Bio" value={bio} onChange={(e) => setBio(e.target.value)} />
                                <Typography variant="h6">Edit Interests</Typography>

                                <FormControl required variant="outlined" sx={{ minWidth: 310, maxWidth: 600 }}>
                                    <InputLabel id="interests-label">Interests</InputLabel>
                                    <SelectStyled
                                        labelId="interests-label"
                                        id="interests"
                                        multiple
                                        value={selectedInterests} 
                                        onChange={(e) => setSelectedInterests(e.target.value)} 
                                        renderValue={(selected) => selected
                                            .map((interestId) => {
                                                const interest = interestsList.find(i => i.id === interestId);
                                                return interest ? interest.name : null;
                                            })
                                            .filter(Boolean)
                                            .join(', ')} 
                                    >
                                        {interestsList.map((interest) => (
                                            <MenuItem key={interest.id} value={interest.id}>
                                                {interest.name}
                                            </MenuItem>
                                        ))}
                                    </SelectStyled>
                                </FormControl>

                                <EditButtonRight variant="contained" color="primary" onClick={handleSaveProfile}>Save Profile</EditButtonRight>
                                <EditButtonRight variant="contained" color="secondary" onClick={handleEditToggle}>Cancel</EditButtonRight>
                            </>
                        ) : (
                            <CardContent>
                                <Grid2 container spacing={2} size={12}>
                                    <Grid2 item xs={12} sm={6}>
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
                                    </Grid2>

                                    <Grid2 item xs={12} sm={6}>
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
                                        <FavoriteIcon /> <strong>Interests:</strong></Typography>
                                            {selectedInterests.length > 0 ? (
                                                selectedInterests.map((interestId) => {
                                                    const interest = interestsList.find((i) => i.id === interestId);
                                                    return interest ? (
                                                        <Typography key={interest.id}>
                                                            {interest.name}
                                                        </Typography>
                                                    ) : null;
                                                })
                                            
                                            ) : (
                                                <Typography>No interests selected.</Typography>
                                            )}
                                        
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
            <DeleteButton variant="contained" color="error" onClick={handleDeleteAccount}>
                Delete Account
            </DeleteButton>
            <LogoutButton variant="contained" color="secondary" onClick={handleLogOut}>
                Logout
            </LogoutButton>
            </AppContainer>
        </ThemeProvider>
    );
};

export default ProfileModal;
