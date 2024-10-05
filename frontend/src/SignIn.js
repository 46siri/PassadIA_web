import React, { useState } from "react";
import Axios from "axios";
import {Button, Box, CssBaseline, Typography, TextField, Snackbar, ThemeProvider} from '@mui/material';
import { styled } from '@mui/system';
import { useNavigate } from 'react-router-dom';
import theme from './Theme/theme';
import GoogleLogo from './Theme/google-logo.svg';
import logo from './Theme/images/logo.png';


const ModalStyled = styled('div')(({ theme }) => ({
  ...theme.overrides.modal,
}));

const ModalContent = styled('div')(({ theme }) => ({
  ...theme.overrides.modalContent,
}));

const Logo = styled('img')({
  ...theme.appLogo1,
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

const OrText = styled(Typography)({
  ...theme.forms.orText,
});

const StyledButton = styled(Button)({
  ...theme.forms.button,
});
const GoogleButton = styled(Button)({
  ...theme.forms.googleButton,
});



const SignInModal = ({ onClose, openForgotPassModal }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleSignIn = async (e) => {
    e.preventDefault();
    try {
      const response = await Axios.post("http://localhost:8080/signin", { email, password });
      setUser(response.data);
      navigate('/WalkerBoard'); 
    } catch (error) {
      setError('Sign in failed: ' + error.message);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      // Logic to handle Google Sign-in
      window.location.href = "http://localhost:8080/auth/google";
    } catch (error) {
      setError('Google sign-in failed: ' + error.message);
    }
  };

 

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ModalStyled>
        <ModalContent>
          <Logo src={logo} alt="logo" />
          <Title variant="h2" gutterBottom>
            Sign In
          </Title>
          <GoogleButton
            variant="contained"
            onClick={handleGoogleSignIn}
            startIcon={<img src={GoogleLogo} alt="Google Logo" />}
          >
            Sign In with Google
          </GoogleButton>
          <Box>
            <OrText variant="body2">
              _________ OR __________
            </OrText>
          </Box>
          <FormGroup onSubmit={handleSignIn}>
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
            <StyledButton variant="contained" color="primary" type="submit">
              Sign In
            </StyledButton>
          </FormGroup>
          <StyledButton variant="contained" color="secondary" onClick={onClose}>
            Close
          </StyledButton>
          <StyledButton variant="text" color="primary" onClick={openForgotPassModal}>
            Forgot Password?
          </StyledButton>
        </ModalContent>
      </ModalStyled>
      {error && (
        <Snackbar
          open={Boolean(error)}
          autoHideDuration={6000}
          onClose={() => setError(null)}
          message={error}
        />
      )}
    </ThemeProvider>
  );
};

export default SignInModal;
