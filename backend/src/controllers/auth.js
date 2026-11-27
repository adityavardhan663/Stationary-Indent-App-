const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { isConnected } = require('../config/db');
const User = require('../models/User');
const { mem } = require('../services/store');
const { logAction } = require('../services/auditService');

const JWT_SECRET = process.env.JWT_SECRET;

exports.login = async (req, res, next) => {
  try {
    const { staffId, password, deviceId } = req.body;
    if (!staffId || !password) {
      return res.status(400).json({ message: 'Staff ID and password are required' });
    }

    const cleanStaffId = String(staffId).trim().toUpperCase();
    let user = null;

    if (isConnected()) {
      user = await User.findOne({ staffId: cleanStaffId });
    } else if (process.env.NODE_ENV !== 'production') {
      user = mem.users.find(u => u.staffId === cleanStaffId);
    } else {
      return res.status(500).json({
        message: 'Database connection unavailable in production.'
      });
    }

    if (!user || !user.active) {
      await logAction({ action: 'LOGIN_FAIL', details: { staffId: cleanStaffId, reason: 'User not found or inactive' }, req });
      return res.status(401).json({ message: 'Invalid Staff ID or password' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      await logAction({ actorId: user._id, action: 'LOGIN_FAIL', details: { staffId: cleanStaffId, reason: 'Incorrect password' }, req });
      return res.status(401).json({ message: 'Invalid Staff ID or password' });
    }

    // Auto-record device if provided (defaults to unapproved; preserves existing approval)
    if (deviceId && typeof deviceId === 'string' && deviceId.trim()) {
      const cleanDeviceId = deviceId.trim();
      if (!Array.isArray(user.devices)) {
        user.devices = [];
      }
      const alreadyRegistered = user.devices.some(d => d.deviceId === cleanDeviceId);
      if (!alreadyRegistered) {
        const newDevice = {
          deviceId: cleanDeviceId,
          label: req.body.deviceLabel ? String(req.body.deviceLabel).trim() : 'Mobile Phone',
          approved: false,
          registeredAt: new Date()
        };
        user.devices.push(newDevice);

        if (isConnected()) {
          await User.findByIdAndUpdate(user._id, { devices: user.devices });
        }
      }
    }

    const secret = JWT_SECRET || process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({
        message: 'Server authentication configuration error.'
      });
    }

    const token = jwt.sign(
      { id: user._id, staffId: user.staffId, role: user.role },
      secret,
      { expiresIn: '24h' }
    );

    await logAction({ actorId: user._id, action: 'LOGIN_SUCCESS', details: { staffId: user.staffId, role: user.role }, req });

    res.json({
      data: {
        token,
        user: {
          id: user._id,
          staffId: user.staffId,
          name: user.name,
          department: user.department,
          role: user.role,
          mustChangePassword: Boolean(user.mustChangePassword),
          email: user.email,
          phone: user.phone,
          devices: user.devices || []
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const currentPassword = req.body.oldPassword || req.body.currentPassword;
    const { newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }

    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters long' });
    }

    let user = null;
    if (isConnected()) {
      user = await User.findById(req.user._id);
    } else if (process.env.NODE_ENV !== 'production') {
      user = mem.users.find(u => u._id === req.user._id || u.staffId === req.user.staffId);
    } else {
      return res.status(500).json({ message: 'Database connection unavailable in production.' });
    }

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Existing password does not match' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    user.passwordHash = newHash;
    user.mustChangePassword = false;

    if (isConnected()) {
      await user.save();
    }

    await logAction({ actorId: user._id, action: 'PASSWORD_CHANGE', req });
    res.json({ data: { message: 'Password changed successfully' } });
  } catch (err) {
    next(err);
  }
};

exports.getMe = async (req, res, next) => {
  try {
    let user = null;
    if (isConnected()) {
      user = await User.findById(req.user._id).select('-passwordHash');
    } else if (process.env.NODE_ENV !== 'production') {
      user = mem.users.find(u => u._id === req.user._id || u.staffId === req.user.staffId);
    } else {
      return res.status(500).json({ message: 'Database connection unavailable in production.' });
    }

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userData = user.toObject ? user.toObject() : { ...user };
    delete userData.passwordHash;

    res.json({ data: userData });
  } catch (err) {
    next(err);
  }
};

exports.registerDevice = async (req, res, next) => {
  try {
    const { deviceId, label } = req.body;
    if (!deviceId || typeof deviceId !== 'string' || !deviceId.trim()) {
      return res.status(400).json({ message: 'deviceId is required' });
    }

    const cleanDeviceId = String(deviceId).trim();

    let user = null;
    if (isConnected()) {
      user = await User.findById(req.user._id);
    } else if (process.env.NODE_ENV !== 'production') {
      user = mem.users.find(u => u._id === req.user._id || u.staffId === req.user.staffId);
    } else {
      return res.status(500).json({ message: 'Database connection unavailable in production.' });
    }

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!Array.isArray(user.devices)) {
      user.devices = [];
    }

    const existing = user.devices.find(d => d.deviceId === cleanDeviceId);
    if (existing) {
      return res.json({ data: { message: 'Device already registered', device: existing } });
    }

    const newDevice = {
      deviceId: cleanDeviceId,
      label: label ? String(label).trim() : 'Mobile Phone',
      approved: false,
      registeredAt: new Date()
    };

    user.devices.push(newDevice);

    if (isConnected()) {
      await user.save();
    }

    await logAction({ actorId: user._id, action: 'DEVICE_REGISTERED', details: { deviceId: cleanDeviceId }, req });

    res.json({ data: { message: 'Device registered successfully', device: newDevice } });
  } catch (err) {
    next(err);
  }
};
