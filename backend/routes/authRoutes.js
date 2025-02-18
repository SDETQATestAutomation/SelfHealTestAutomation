const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Simple route to register (optional for your scenario)
router.post('/register', async (req, res) => {
  const { email, password } = req.body;
  try {
    await User.create(email, password);
    res.status(201).json({ message: 'User registered successfully.' });
  } catch (error) {
    res.status(400).json({ error: 'Email already exists or invalid data.' });
  }
});

// Login route
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }
    if (user.password !== password) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }
    // On success, return something that helps maintain session or token
    res.json({ message: 'Login successful', userId: user.id });
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;