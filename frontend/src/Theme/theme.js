import { createTheme } from '@mui/material/styles';
import { display } from '@mui/system';

const theme = createTheme({
  palette: {
    primary: {
      main: '#214a27',
    },
    secondary: {
      main: '#663300',
    },
    error: {
      main: '#f13a59',
    },
    google: {
      main: '#fff',
    },
  },
  typography: {
    fontFamily: 'Roboto, sans-serif',
  },
  shape: {
    borderRadius: 10,
  },
  background: {
    default: '#fff',
  },
  spacing: 2,
  
  root: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
    minHeight: '100vh',
  },
  appLogo: {
    width: '60%',
    maxHeight: '100vh',
    pointerEvents: 'none',
  },
  appLogo1: {
    width: '50%',
    maxHeight: '30vh',
    pointerEvents: 'none',
  },
  paperContainer: {
    width: '100%',
    textAlign: 'center',
    marginTop: 20,
  },
  smallPhrase: {
    fontSize: '1vw',
    fontWeight: 'bold',
    color: '#633f0f',
    marginTop: 30,
  },
  medSizePhrase: {
    fontSize: '1.5vw',
    color: '#214a27',
    marginBottom: 10,
    marginTop: 10,

  },
  phrase: {
    fontSize: '3vw',
    color: '#633f0f',
    marginTop: 0,
    marginBottom: 20,
    fontFamily: '"Eczar", serif',
  },
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backdropFilter: 'blur(5px)',
  },
  forms: {
    formGroup: {
      marginLeft: '1px',
    },
    textField: {
      width: '60%',
      marginBottom: '10px',
    },
    button: {
      width: '60%',
      marginTop: '10px',
    },
    select: {
      width: '100%',
      marginBottom: '10px',
    },
    orText: {
      marginBottom: '20px', 
      textAlign: 'center',
    },
    //grey google button
    googleButton: {
      width: '43%',
      marginTop: '10px',
      backgroundColor: '#f1f1f1',
      color: '#000',
      '&:hover': {
        backgroundColor: '#f1f1f1',
      },
    },

  },
  overrides: {
    MuiButton: {
      root: {
        margin: '10px 0',
      },
    },
    modal: {
      display: 'flex',
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      backgroundColor: '#fff',
      borderRadius: 20,
      width: 'auto',
      maxWidth: '600px', // Maximum width
      minWidth: '300px', // Minimum width to prevent it from becoming too small
      boxShadow: '0px 4px 15px rgba(0, 0, 0, 0.2)',
      padding: '40px', 
    },
    modalContent: {
      textAlign: 'center',
    },
    logoContainer: {
      margin: '0 auto',
    },
    title: {
      fontSize: '2vw',
      fontWeight: 'bold',
      color: '#633f0f',
      marginBottom: 20,
    },
  },
  
});


export default theme;
