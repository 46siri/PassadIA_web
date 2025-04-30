import React, { useEffect, useState } from 'react';
import Axios from 'axios';
import {
  Container, Typography, Tabs, Tab, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  IconButton, Button, ThemeProvider, CssBaseline, Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { styled } from '@mui/system';
import { useNavigate } from 'react-router-dom';
import theme from '../Theme/theme';
import logo from '../Theme/images/baselogo.jpg';

const AppContainer = styled(Container)(({ theme }) => ({
  ...theme.root,
  zIndex: 9999,
}));

const Logo = styled('img')(({ theme }) => ({
  position: 'absolute',
  top: theme.spacing(2),
  left: theme.spacing(50),
  width: '200px',
  height: 'auto',
  cursor: 'pointer',
}));

const LogoutButton = styled(Button)({
  position: 'absolute',
  right: 100,
  top: 20,
});

const AdminBoard = ({ onLogout }) => {
  const [tabIndex, setTabIndex] = useState(0);
  const [walkways, setWalkways] = useState([]);
  const [users, setUsers] = useState([]);
  const [confirmationDialog, setConfirmationDialog] = useState({ open: false, type: '', id: '' });
  const [level, setLevel] = useState([]);

  const navigate = useNavigate();

useEffect(() => {
  const fetchData = async () => {
    try {
      const [walkwaysRes, usersRes] = await Promise.all([
        Axios.get('http://localhost:8080/allWalkways', { withCredentials: true }),
        Axios.get('http://localhost:8080/allUsers', { withCredentials: true })
      ]);

      const usersWithLevels = await Promise.all(
        usersRes.data.map(async (user) => {
          try {
            const { data } = await Axios.get(`http://localhost:8080/getLevelByEmail/${encodeURIComponent(user.email)}`, { withCredentials: true });
            return { ...user, level: data.level };
          } catch (err) {
            console.error(`Failed to get level for ${user.email}`, err);
            return { ...user, level: 'N/A' };
          }
        })
      );      

      setWalkways(walkwaysRes.data);
      setUsers(usersWithLevels);
    } catch (err) {
      console.error('Error loading data:', err);
    }
  };

  fetchData();
}, []);




  const handleDelete = async (type, id) => {
    try {
      if (type === 'user') {
        const user = users.find(u => u.id === id); 
        if (!user) return;
        await Axios.post(
          'http://localhost:8080/deleteUser',
          { email: user.email },
          { withCredentials: true }
        );
        setUsers(prev => prev.filter(u => u.id !== id));
        console.log('User deleted successfully.');
      } else if (type === 'walkway') {
        await Axios.post(`http://localhost:8080/deleteWalkway/${id}`, { withCredentials: true });
        setWalkways(prev => prev.filter(w => w.id !== id));
        console.log('Walkway deleted successfully.');
      }
      setConfirmationDialog({ open: false, type: '', id: '' });
    } catch (error) {
      console.error(`Error deleting ${type}:`, error);
    }
  };

  const handleApprove = async (email) => {
    try {
      await Axios.post('http://localhost:8080/approveCityCouncil', { email }, { withCredentials: true });
      setUsers(prev => prev.map(u => u.email === email ? { ...u, status: 'approved' } : u));
      console.log('Authority approved successfully.');
    } catch (err) {
      console.error('Error approving authority:', err);
    }
  };
  

  const handleLogOut = async () => {
    try {
      await Axios.get("http://localhost:8080/logout", { withCredentials: true });
      console.log("Logged out successfully!");
      onLogout && onLogout();
      navigate('/App');
    } catch (error) {
      console.error('Failed to log out: ' + error.message);
    }
  };

  
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppContainer>
        <Logo src={logo} alt="logo" onClick={() => navigate('/AdminBoard')} />
        <LogoutButton variant="contained" color="secondary" onClick={handleLogOut}>Logout</LogoutButton>

        <Typography
                variant="h4"
                sx={{
                    marginTop: theme.spacing(8),
                    marginBottom: theme.spacing(4),
                    color: theme.palette.primary.main,
                    textAlign: 'center',
                }}
                >
                Admin Board
            </Typography>        <Tabs value={tabIndex} onChange={(_, newValue) => setTabIndex(newValue)}>
          <Tab label="Users" />
          <Tab label="Walkways" />
        </Tabs>

        {tabIndex === 0 && (
        <>
            <Paper
                elevation={1}
                sx={{
                    mt: 3,
                    p: 2,
                    overflowX: 'auto',
                    backgroundColor: '#fff',
                    maxWidth: '95%',
                    mx: 'auto'
                }}
                >

            <Typography variant="h5" sx={{ mb: 4, pl: 4, color: theme.palette.primary.main }}>
            Walker Users
            </Typography>
            <Table size="small" >
                <TableHead sx={{ backgroundColor: '#f5f5f5' }}>
                <TableRow sx={{ backgroundColor: '#f0f4f8' }}>
                    <TableCell><strong>Name</strong></TableCell>
                    <TableCell><strong>Email</strong></TableCell>
                    <TableCell><strong>Points</strong></TableCell>
                    <TableCell><strong>Level</strong></TableCell>
                    <TableCell><strong>Actions</strong></TableCell>
                </TableRow>
                </TableHead>
                <TableBody>
                {users.filter((user) => user.role === 'Walker').map((user, index) => (
                    <TableRow
                    key={user.id}
                    sx={{ backgroundColor: index % 2 === 0 ? '#ffffff' : '#fafafa' }}
                    >
                    <TableCell>{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.points}</TableCell>
                    <TableCell>{user.level}</TableCell>
                    <TableCell>
                        <IconButton
                        onClick={() => setConfirmationDialog({ open: true, type: 'user', id: user.id })}
                        color="error"
                        >
                        <DeleteIcon />
                        </IconButton>
                    </TableCell>
                    </TableRow>
                ))}
                </TableBody>
            </Table>
            </Paper>

            <Paper
                elevation={1}
                sx={{
                    mt: 10,
                    p: 2,
                    overflowX: 'auto',
                    backgroundColor: '#fff',
                    maxWidth: '95%',
                    mx: 'auto'
                }}
            >
            <Typography variant="h5" sx={{ mb: 4, pl: 4,color: theme.palette.primary.main }}>
                City Council Users
            </Typography>
            <Table size="small" >
                <TableHead>
                <TableRow sx={{ backgroundColor: '#f0f4f8' }}>
                    <TableCell sx={{ fontWeight: 'bold' }}>Institution</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Email</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Position</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Location</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Registration</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Actions</TableCell>
                </TableRow>
                </TableHead>
                <TableBody>
                {users.filter((user) => user.role === 'Staff').map((user, index) => (
                    <TableRow
                    key={user.id}
                    sx={{ backgroundColor: index % 2 === 0 ? '#ffffff' : '#fafafa' }}
                    >
                    <TableCell>{user.institutionName}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.positionType}</TableCell>
                    <TableCell>{user.location}</TableCell>
                    <TableCell>{user.registrationDate}</TableCell>
                    <TableCell>{user.status}</TableCell>
                    <TableCell>
                        {user.status === 'pending' && (
                        <IconButton
                            onClick={() => handleApprove(user.email)}
                            color="success"
                        >
                            <CheckCircleIcon />
                        </IconButton>
                        )}
                        <IconButton
                        onClick={() => setConfirmationDialog({ open: true, type: 'user', id: user.id })}
                        color="error"
                        >
                        <DeleteIcon />
                        </IconButton>
                    </TableCell>
                    </TableRow>
                ))}
                </TableBody>
            </Table>
            </Paper>
        </>
        )}

        {tabIndex === 1 && (
          <Paper sx={{ mt: 3, p: 2 }}>
            <Typography variant="h5" sx={{ mb: 4, pl: 4, color: theme.palette.primary.main }}>
                Walkway List
            </Typography>
            <Table>
              <TableHead>
              <TableRow sx={{ backgroundColor: '#f0f4f8' }}>
              <TableCell>Name</TableCell>
                  <TableCell>District</TableCell>
                  <TableCell>Region</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {walkways.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell>{w.name}</TableCell>
                    <TableCell>{w.district}</TableCell>
                    <TableCell>{w.region}</TableCell>
                    <TableCell>
                      <IconButton onClick={() => setConfirmationDialog({ open: true, type: 'walkway', id: w.id })} color="error">
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        )}

        <Dialog open={confirmationDialog.open} onClose={() => setConfirmationDialog({ open: false, type: '', id: '' })}>
          <DialogTitle>Confirmation</DialogTitle>
          <DialogContent>
            Are you sure you want to delete this {confirmationDialog.type === 'user' ? 'user' : 'walkway'}?
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmationDialog({ open: false, type: '', id: '' })}>Cancel</Button>
            <Button onClick={() => handleDelete(confirmationDialog.type, confirmationDialog.id)} color="error">Delete</Button>
          </DialogActions>
        </Dialog>

      </AppContainer>
    </ThemeProvider>
  );
};

export default AdminBoard;
