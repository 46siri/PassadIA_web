import React, { useState, useEffect } from 'react';
import { Button, CssBaseline, Typography, TextField, Snackbar, makeStyles, ThemeProvider } from '@material-ui/core';
import { getAuth, sendPasswordResetEmail } from '../../services/firebase.config';
import { onAuthStateChanged } from 'firebase/auth';
import theme from '../../Theme/theme';

const useStyles = makeStyles((theme) => ({
  modal: {
    ...theme.overrides.modal,
    height: '65%',
    marginTop: '10%',
  },
  modalContent: {
    ...theme.overrides.modalContent,
  },
  logoContainer: {
    ...theme.overrides.logoContainer,
  },
  title: {
    ...theme.overrides.title,
  },
  formGroup: {
    ...theme.forms.formGroup,
  },
  textField: {
    ...theme.forms.textField,
  },
  button: {
    ...theme.forms.button,
  },
}));

function ForgotPassModal({ onClose }) {
  const classes = useStyles();
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, []);

  const handleForgotPassword = async () => {
    const auth = getAuth();
  
    try {
      await sendPasswordResetEmail(auth, email);
      alert('Password reset email sent!');
      onClose();
    } catch (error) {
      console.error('Error sending password reset email:', error);
      setError('Failed to send password reset email: ' + error.message);
    }
  };
  

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div className={classes.modal}>
        <div className={classes.modalContent}>
          <Typography variant="h2" className={classes.title}>
            Reset Your Password
          </Typography>
          <form className={classes.formGroup} onSubmit={handleForgotPassword}>
            <TextField
              className={classes.textField}
              type="email"
              id="email"
              label="Email"
              variant="outlined"
              fullWidth
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button className={classes.button} variant="contained" color="primary" onClick={handleForgotPassword}>
              Send Reset Email
            </Button>
          </form>
          <Button className={classes.button} variant="contained" color="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
      {error && (
        <Snackbar
          open={error !== null}
          autoHideDuration={6000}
          onClose={() => setError(null)}
          message={error}
        />
      )}
    </ThemeProvider>
  );
}

export default ForgotPassModal;
