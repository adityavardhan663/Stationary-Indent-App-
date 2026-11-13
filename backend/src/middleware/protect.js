const jwt = require('jsonwebtoken');
const { isConnected } = require('../config/db');
const User = require('../models/User');
const { mem } = require('../services/store');

const JWT_SECRET = process.env.JWT_SECRET || 'stationery_dev_secret_key_2026';

const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Authentication required. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    let user = null;

    if (isConnected()) {
      user = await User.findById(decoded.id).select('-passwordHash');
    }

    if (!user) {
      user = mem.users.find(u => u._id === decoded.id || u.staffId === decoded.staffId);
    }

    if (!user || !user.active) {
      return res.status(401).json({ message: 'User account not found or deactivated.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired authorization token.' });
  }
};

module.exports = protect;
