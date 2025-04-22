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

// Styled components using MUI's new styled API
export const AppContainer = styled(Container)(({ theme }) => ({
    ...theme.root,
    zIndex: 9999,
    backgroundColor: '#ffffff', // Alterado de #f5f5f5 para branco puro
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column', // adiciona para alinhar conteúdo verticalmente
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
    const [interestsList, setInterestsList] = useState([]); // List of interests fetched from backend
    const [selectedInterests, setSelectedInterests] = useState([]); // List of selected interests
    const [showChangePhoto, setShowChangePhoto] = useState(false); 
    const [points, setPoints] = useState(0);
    const [level, setLevel] = useState([]);

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

    const handleLogoClick = () => {
        navigate('/WalkerBoard');

    };

    // Menu Handlers 
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
            const response = await Axios.post('http://localhost:8080/updateProfile', {
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

    const handleChangePhoto = async () => {
        setLoading(true);
        setError(null);
        try {
            console.log('Uploading photo...');
            const response = await Axios.post('http://localhost:8080/changePhoto', {
                avatarURL,
            });
            if (response.status === 200) {
                setSuccess('Photo updated successfully!');
            }
        } catch (error) {
            setError('Error updating photo: ' + error.message);
        } finally {
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
            {/* Nível e Pontos */}
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
                {/* Avatar Section */}
                <Grid2 item xs={12} sm={5} style={{ textAlign: 'center' }} marginBottom={10}>
                <Typography variant="h4" gutterBottom>{name}</Typography>
                    <label htmlFor="avatar-upload">
                        <AvatarStyled
                            src={avatarURL}
                            onClick={() => document.getElementById('avatar-upload').click()} // Make the avatar clickable
                            onMouseEnter={() => setShowChangePhoto(true)} // Show button on hover
                            onMouseLeave={() => setShowChangePhoto(false)} // Hide button when not hovering
                            style={{ cursor: 'pointer', position: 'relative' }}
                        />
                        <input
                            accept="image/*"
                            style={{ display: 'none' }}
                            id="avatar-upload"
                            type="file"
                            onChange={handleChangePhoto} // Trigger file change
                        />
                        {showChangePhoto && (
                            <Button
                                variant="flex"
                                color="grey"
                                onClick={() => document.getElementById('avatar-upload').click()} // Button triggers file selection
                                style={{
                                    position: 'absolute',
                                    top: '43%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    opacity: 0.8, // Slightly transparent to blend in with avatar
                                }}
                            >
                                Change Photo
                            </Button>
                        )}
                    </label>
                    {uploading && <CircularProgress />}
                    
                </Grid2>

                {/* Profile Information Section */}
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
                                        value={selectedInterests} // Agora, seleciona múltiplos interesses
                                        onChange={(e) => setSelectedInterests(e.target.value)} // Atualiza os interesses selecionados
                                        renderValue={(selected) => selected
                                            .map((interestId) => {
                                                const interest = interestsList.find(i => i.id === interestId);
                                                return interest ? interest.name : null;
                                            })
                                            .filter(Boolean)
                                            .join(', ')} // Mostra os interesses selecionados no campo de seleção
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
                                    {/* Left Column */}
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

                                    {/* Right Column */}
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

            <LogoutButton variant="contained" color="secondary" onClick={handleLogOut}>
                Logout
            </LogoutButton>
            </AppContainer>
        </ThemeProvider>
    );
};

export default ProfileModal;
