import React from 'react';
import ReactDOM from 'react-dom/client';
import { Route, Routes, BrowserRouter as Router } from 'react-router-dom'; // Import Router
import App from './App'; 
import SignInModal from './SignIn';
import SignUpModal from './SignUp';
import WalkerBoard from './WalkerBoard';
import ProfileModal from './Profile';
import CityCouncilBoard from './CityCouncilBoard';
import MerchantBoard from './MerchantBoard';
import Favorites from './Favorites';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Router>
      <Routes>
        <Route index element={<App />} />
        <Route path="/App" element={<App />} />
        <Route path="/signin" element={<SignInModal />} />
        <Route path="/signup" element={<SignUpModal />} />
        <Route path="/Profile" element={<ProfileModal />} />
        <Route path="/Favorites" element={<Favorites />} />
        <Route path="/WalkerBoard" element={<WalkerBoard />} />
        <Route path="/CityCouncilBoard" element={<CityCouncilBoard />} />
        <Route path="/MerchantBoard" element={<MerchantBoard />} />
      </Routes>
    </Router>
  </React.StrictMode>
);

