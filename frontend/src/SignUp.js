import React, { useState } from "react";
import Axios from "axios";
import {
    Button, CssBaseline, Typography, TextField, Snackbar, 
    ThemeProvider, FormControl, Select, MenuItem, InputLabel
  } from '@mui/material';
import { styled } from '@mui/system';
import theme from './Theme/theme';
import GoogleLogo from './Theme/google-logo.svg';
import logo from './Theme/images/logo.png';


const ModalStyled = styled('div')(({ theme }) => ({
  ...theme.overrides.modal,
}));

const ModalContent = styled('div')(({ theme }) => ({
  ...theme.overrides.modalContent,

}));

const LogoContainer = styled('img')({
  ...theme.overrides.logoContainer,

});
const Title = styled(Typography)({
  ...theme.overrides.title,
});

const FormGroup = styled('form')({
  ...theme.forms.formGroup,
});

const TextF = styled(TextField)({
  ...theme.forms.textField,
});

const StyledButton = styled(Button)({
  ...theme.forms.button,
});
const SelectStyled = styled(Select)({
    ...theme.forms.select,
});

const Logo = styled('img')({
    ...theme.appLogo1,
});



const SignUpModal = ({ onClose }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [birthdate, setBirthdate] = useState('');
    const [userId, setUserId] = useState('');
    const [name, setName] = useState('');
    const [role, setRole] = useState('');

    const [institutionName, setInstitutionName] = useState('');
    const [positionType, setPositionType] = useState('');
    const [location, setLocation] = useState('');
    const [registrationDate, setRegistrationDate] = useState(() => {
      const today = new Date();
      return today.toISOString().split('T')[0]; // formato "YYYY-MM-DD"
    });
        
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null); // Add success state
    const [open, setOpen] = useState(false);

    const handleOpen = () => setOpen(true);
    const handleClose = () => setOpen(false);

    const resetForm = () => {
      setEmail('');
      setPassword('');
      setBirthdate('');
      setUserId('');
      setName('');
      setRole('');
      setInstitutionName('');
      setPositionType('');
      setLocation('');
      setRegistrationDate('');
    };


    const handleSignUp = async (e) => {
      e.preventDefault();
      setError(null);
      setSuccess(null);
    
      try {
        if (role === "Staff") {
          // Envia pedido de registo para aprovação
          const response = await Axios.post("http://localhost:8080/signup-pending", {
            email,
            password,
            userId,
            institutionName,
            role,
            registrationDate,
            positionType,
            location,
            status: "pending"
          });          
    
          console.log('City Council registration pending approval:', response.data);
          setSuccess("Your request has been submitted and is awaiting admin approval.");
        } else {
          // Registo normal
          const response = await Axios.post("http://localhost:8080/signup", {
            email, password, name, birthdate, userId, role
          });
    
          console.log('Sign-up successful:', response.data);
          setSuccess("Registration successful!");
        }
    
        resetForm();
    
      } catch (error) {
        setError('Registration failed: ' + error.message);
      }
    };
    

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ModalStyled>
        <ModalContent>
          <Logo src={logo} alt="logo" />
          <Title variant="h2" gutterBottom>
            Sign Up
          </Title>
          <FormGroup onSubmit={handleSignUp}>
          <FormControl required variant="outlined" sx={{ minWidth: 310, maxWidth: 600}}>
                <InputLabel id="role">Role</InputLabel>
                <SelectStyled
                    value={role}
                    open={open}
                    onClose={handleClose}
                    onOpen={handleOpen}
                    onChange={(e) => setRole(e.target.value)}
                    label="Role"
                    required
                >
                    <MenuItem value="Staff">City ​​Council</MenuItem>
                    <MenuItem value="Walker">Walker</MenuItem>
                </SelectStyled>
            </FormControl>
            <TextF
              type="email"
              id="email"
              label="Email"
              variant="outlined"
              fullWidth
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <TextF
              type="password"
              id="password"
              label="Password"
              variant="outlined"
              fullWidth
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <TextF
                type="text"
                id="userId"
                label="User ID"
                variant="outlined"
                fullWidth
                required
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
            />
            {role === "Walker" && (
              <>
            <TextF
                type="text"
                id="name"
                label="Name"
                variant="outlined"
                fullWidth
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
            />
              <TextF 
                type="date"
                id="birthdate"
                label="Birthdate"
                variant="outlined"
                fullWidth
                required
                InputLabel={{ shrink: true }} // Garante que o label fique visível
                InputProps={{
                  sx: {
                    textAlign: 'right', // Alinha o texto à direita no campo
                    '& input': {
                      textAlign: 'right', // Alinha a data à direita
                    }
                  }
                }}
                value={birthdate}
                onChange={(e) => setBirthdate(e.target.value)}
              />
            </>
            
          )}
          {role === "Staff" && (
            <>
              <TextF
                type="text"
                id="institutionName"
                label="Institution Name"
                variant="outlined"
                fullWidth
                required
                value={institutionName}
                onChange={(e) => setInstitutionName(e.target.value)}
              />
              <TextF
                type="text"
                id="positionType"
                label="Position (e.g. Câmara Municipal)"
                variant="outlined"
                fullWidth
                required
                value={positionType}
                onChange={(e) => setPositionType(e.target.value)}
              />
              <TextF
                type="text"
                id="location"
                label="Location"
                variant="outlined"
                fullWidth
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </>
          )}

            
            <StyledButton variant="contained" color="primary" type="submit">
              Sign Up
            </StyledButton>
          </FormGroup>
          <StyledButton variant="contained" color="secondary" onClick={onClose}>
            Close
          </StyledButton>
        </ModalContent>
      </ModalStyled>
      
      {/* Display error Snackbar */}
      {error && (
        <Snackbar
          open={Boolean(error)}
          autoHideDuration={6000}
          onClose={() => setError(null)}
          message={error}
        />
      )}

      {/* Display success Snackbar */}
      {success && (
        <Snackbar
          open={Boolean(success)}
          autoHideDuration={6000}
          onClose={() => setSuccess(null)}
          message={success}
        />
      )}
      {role === "Staff" && (
        <Typography variant="caption" color="textSecondary">
          This registration requires admin approval before you can log in.
        </Typography>
      )}
    </ThemeProvider>
  );
};

export default SignUpModal;
