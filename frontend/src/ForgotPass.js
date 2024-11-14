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

const ForgotPassModal = ({ onClose }) => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    console.log("Sending password reset request for email:", email); // Log email
    try {
      // Chama o endpoint do backend para enviar o email de redefinição de senha
      const response = await Axios.post("http://localhost:8080/forgotPassword", { email });
      setSuccess(response.data.message);
      setSuccess("Reset Email Sent!")
      setError(null);
    } catch (error) {
      setError("Failed to send password reset email. Please try again.");
      setSuccess(null);
    }
  };
  

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ModalStyled>
        <ModalContent>
          <Title variant="h2" gutterBottom>
            Reset Your Password
          </Title>
          <FormGroup onSubmit={handleForgotPassword}>
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
            <StyledButton variant="contained" color="primary" onClick={handleForgotPassword}>
              Send Reset Email
            </StyledButton>
          </FormGroup>
          <StyledButton variant="contained" color="secondary" onClick={onClose}>
            Close
          </StyledButton>
        </ModalContent>
      </ModalStyled>
      {error && (
        <Snackbar
          open={error !== null}
          autoHideDuration={6000}
          onClose={() => setError(null)}
          message={error}
        />
      )}
      {success && (
        <Snackbar
          open={success !== null}
          autoHideDuration={6000}
          onClose={() => setSuccess(null)}
          message={success}
        />
      )}
    </ThemeProvider>
  );
}

export default ForgotPassModal;
