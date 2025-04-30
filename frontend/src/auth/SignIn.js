import React, { useState } from "react";
import Axios from "axios";
import {Button, Box, CssBaseline, Typography, TextField, Snackbar, ThemeProvider} from '@mui/material';
import { styled } from '@mui/system';
import { useNavigate } from 'react-router-dom';
import theme from '../Theme/theme';
import logo from '../Theme/images/logo.png';
import ForgotPassModal from './ForgotPass'; 

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



const SignInModal = ({ onClose }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);
  const [forgotPassOpen, setForgotPassOpen] = useState(false); 
  const navigate = useNavigate();

  const handleSignIn = async (e) => {
    e.preventDefault();
    try {
        const signInResponse = await Axios.post("http://localhost:8080/signin", { email, password }, {
          withCredentials: true
        });
        console.log("Sign-in response:", signInResponse.data);

        setUser(signInResponse.data.user);
        console.log("User:", signInResponse.data.user);

        const userDataResponse = await Axios.get("http://localhost:8080/user", {
            params: { email: signInResponse.data.user.email }
        },{
          withCredentials: true
        });
        
        let role = userDataResponse.data.role;
        console.log("Role:", role);
        if(role === "Walker") {
          console.log("Walker role detected");
            navigate('/WalkerBoard');
        } else if (role === "Staff"){
            navigate('/CityCouncilBoard');
        }
        else if (role === 'admin') {
          navigate('/AdminBoard');
        } else {
            console.error("Invalid role:", role);
            setError("Invalid role: " + role);
        }     
    } catch (error) {
        console.error('Sign in failed:', error);
        setError('Sign in failed: ' + (error.response ? error.response.data.message : error.message));
    }
};


  const openForgotPassModal = () => {
    setForgotPassOpen(true);
  };

  const closeForgotPassModal = () => {
    setForgotPassOpen(false);
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
      {forgotPassOpen && <ForgotPassModal onClose={closeForgotPassModal} />}
    </ThemeProvider>
  );
};

export default SignInModal;
