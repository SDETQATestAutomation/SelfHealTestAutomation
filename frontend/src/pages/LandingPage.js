import React from 'react';
import { useNavigate } from 'react-router-dom';
import './LandingPage.css';

const LandingPage = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    // Example: Clear user token or other login info from localStorage
    localStorage.removeItem('authToken');
    // Redirect back to login
    navigate('/');
  };

  return (
    <div className="landing-container">
      <h1>Welcome to Self Heal Test Automation!</h1>
      <p>You have successfully logged in.</p>
      <button className="logout-button" onClick={handleLogout}>
        Logout
      </button>
    </div>
  );
};

export default LandingPage;