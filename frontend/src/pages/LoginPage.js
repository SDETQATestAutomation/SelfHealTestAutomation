import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './LoginPage.css'; // We'll create this stylesheet next

const LoginPage = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState(''); // 'success' or 'error'

  // Helper function to show a temporary message
  const showMessage = (msg, type) => {
    setMessage(msg);
    setMessageType(type);

    // Auto-hide after 3 seconds
    setTimeout(() => {
      setMessage('');
      setMessageType('');
    }, 3000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch('http://localhost:5001/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();

      if (response.ok) {
        showMessage('Login successful!', 'success');
        // Redirect to landing page after a short delay
        setTimeout(() => {
          navigate('/landing');
        }, 1500);
      } else {
        showMessage(data.error || 'Login failed!', 'error');
      }
    } catch (err) {
      console.error(err);
      showMessage('An error occurred. Please try again.', 'error');
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>Self Heal Test Automation</h2>

        {/* Auto-hiding message */}
        {message && (
          <div className={`message ${messageType}`}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              id="email"
              placeholder="yourname@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              id="password"
              placeholder="********"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" id="submit">Login</button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;