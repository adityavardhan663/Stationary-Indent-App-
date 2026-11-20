
const jwt = require('jsonwebtoken');
const { isConnected } = require('../config/db');
const User = require('../models/User');
const { mem } = require('../services/store');

const JWT_SECRET = process.env.JWT_SECRET;

const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({
      message: 'Authentication required. No token provided.'
    });
  }

  if (!JWT_SECRET) {
    return res.status(500).json({
      message: 'Server authentication configuration error.'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    let user = null;

    if (isConnected()) {
      // MongoDB mode: authenticate only against MongoDB.
      user = await User.findById(decoded.id).select('-passwordHash');
    } else if (process.env.NODE_ENV !== 'production') {
      // Development-only memory mode.
      user = mem.users.find(
        u => u._id === decoded.id || u.staffId === decoded.staffId
      );
    }

    if (!user || !user.active) {
      return res.status(401).json({
        message: 'User account not found or deactivated.'
      });
    }

    req.user = user;
    return next();

  } catch (err) {
    return res.status(401).json({
      message: 'Invalid or expired authorization token.'
    });
  }
};

module.exports = protect;
