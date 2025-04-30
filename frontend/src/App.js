import React, { useEffect, useState } from "react";
import Axios from "axios";
import { Button, Container, CssBaseline, Typography, Paper, ThemeProvider } from '@mui/material';
import { styled } from '@mui/system';
import theme from './Theme/theme';
import logo from './Theme/images/baselogo.jpg';
import SignInModal from './auth/SignIn';
import SignUpModal from './auth/SignUp';


const AppContainer = styled(Container)(({ theme }) => ({
  ...theme.root,
}));

const Logo = styled('img')(({ theme }) => ({
  ...theme.appLogo,
}));

const Phrase = styled(Typography)(({ theme }) => ({
  ...theme.phrase,
}));

const MedSizePhrase = styled(Typography)(({ theme }) => ({
  ...theme.medSizePhrase,
}));

const PaperContainer = styled(Paper)(({ theme }) => ({
  ...theme.paperContainer,
}));

const SmallPhrase = styled(Typography)(({ theme }) => ({
  ...theme.smallPhrase,
}));

const Overlay = styled('div')(({ theme }) => ({
  ...theme.overlay,
}));

const App = () => {
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [data, setData] = useState(null);


  const getData = async () => {
    const response = await Axios.get("http://localhost:8080/");
    setData(response.data);
  };

  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false);
  const openSignInModal = () => {
    setIsSignInModalOpen(true);
  };
  const closeSignInModal = () => {
    setIsSignInModalOpen(false);
  };
  const [isSignUpModalOpen, setIsSignUpModalOpen] = useState(false);
  const openSignUpModal = () => {
    setIsSignUpModalOpen(true);
  };
  const closeSignUpModal = () => {
    setIsSignUpModalOpen(false);
  };


  useEffect(() => {
    getData();
  }, []);



  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppContainer>
        <Logo src={logo} alt="logo" />
        <Phrase variant="h4">
          Discover the nature of Portugal in another way
        </Phrase>
        <PaperContainer>
          <MedSizePhrase variant="h5">
            Register to start your journey.
          </MedSizePhrase>
          <div>
            <Button variant="contained" color="primary" onClick={openSignUpModal}>
              Create an account
            </Button>
          </div>
          <SmallPhrase variant="body2">
            Already have an account?
          </SmallPhrase>
          <Button variant="contained" color="secondary" onClick={openSignInModal}>
            Sign In
          </Button>
        </PaperContainer>
        {isSignInModalOpen && (
          <Overlay>
            <SignInModal onClose={closeSignInModal} />
          </Overlay>
        )}
        {isSignUpModalOpen && (
          <Overlay>
            <SignUpModal onClose={closeSignUpModal} />
          </Overlay>
        )}
      </AppContainer>
    </ThemeProvider>
  );
};

export default App;
