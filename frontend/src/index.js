import React from 'react';
import ReactDOM from 'react-dom/client';
import { Route, Routes, BrowserRouter as Router } from 'react-router-dom'; // Import Router
import App from './App'; 
import SignInModal from './auth/SignIn';
import SignUpModal from './auth/SignUp';
import WalkerBoard from './dashboards/WalkerBoard';
import ProfileModal from './profiles/Profile';
import CityCouncilBoard from './dashboards/CityCouncilBoard';
import Favorites from './walkerSpecifics/Favorites';
import History from './walkerSpecifics/History';
import CityCouncilProfile from './profiles/CityCouncilProfile';
import AdminBoard from './dashboards/AdminBoard';
import MyWalkways from './cityCouncilSpecifics/MyWalkways';

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
        <Route path="/History" element={<History />} />
        <Route path="/WalkerBoard" element={<WalkerBoard />} />
        <Route path="/CityCouncilBoard" element={<CityCouncilBoard />} />
        <Route path="/CityCouncilProfile" element={<CityCouncilProfile />} />
        <Route path="/AdminBoard" element={<AdminBoard />} />
        <Route path="/MyWalkways" element={<MyWalkways />} />
      </Routes>
    </Router>
  </React.StrictMode>
);

