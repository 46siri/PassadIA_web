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
    };

    const handleSignUp = async (e) => {
        e.preventDefault();
        setError(null); // Clear previous errors
        setSuccess(null); // Clear previous success

        try {
          const response = await Axios.post("http://localhost:8080/signup", { 
            email, password, name, birthdate, userId, role 
          });
          console.log('SignUp successful:', response.data);

          // Display success message
          setSuccess('Sign up successful!');

          // Optionally, reset form fields
          resetForm();

        } catch (error) {
          setError('Sign up failed: ' + error.message);
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
                type="date"
                id="birthdate"
                label="Birthdate"
                variant="outlined"
                fullWidth
                required
                slotProps={{
                  inputLabel: {
                    shrink: true,  
                  },
                }}
                value={birthdate}
                onChange={(e) => setBirthdate(e.target.value)}
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
                    <MenuItem value="Merchant">Merchant</MenuItem>
                </SelectStyled>
            </FormControl>
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
    </ThemeProvider>
  );
};

export default SignUpModal;
