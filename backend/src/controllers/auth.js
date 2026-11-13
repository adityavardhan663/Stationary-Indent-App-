const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { isConnected } = require('../config/db');
const User = require('../models/User');
const { mem } = require('../services/store');
const { logAction } = require('../services/auditService');

const JWT_SECRET = process.env.JWT_SECRET || 'stationery_dev_secret_key_2026';

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
    }
    if (!user) {
      user = mem.users.find(u => u.staffId === cleanStaffId);
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

    // Auto-record device if provided
    if (deviceId && user.devices && !user.devices.some(d => d.deviceId === deviceId)) {
      user.devices.push({
        deviceId,
        label: req.body.deviceLabel || 'Mobile Phone',
        approved: true, // auto-approve for convenience in prototype
        registeredAt: new Date()
      });
      if (isConnected()) {
        await User.findByIdAndUpdate(user._id, { devices: user.devices });
      }
    }

    const token = jwt.sign(
      { id: user._id, staffId: user.staffId, role: user.role },
      JWT_SECRET,
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
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }

    let user = null;
    if (isConnected()) {
      user = await User.findById(req.user._id);
    } else {
      user = mem.users.find(u => u._id === req.user._id);
    }

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);
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

exports.getMe = async (req, res) => {
  res.json({ data: req.user });
};

exports.registerDevice = async (req, res, next) => {
  try {
    const { deviceId, label } = req.body;
    if (!deviceId) {
      return res.status(400).json({ message: 'deviceId is required' });
    }

    let user = null;
    if (isConnected()) {
      user = await User.findById(req.user._id);
    } else {
      user = mem.users.find(u => u._id === req.user._id);
    }

    const existing = user.devices?.find(d => d.deviceId === deviceId);
    if (existing) {
      return res.json({ data: { message: 'Device already registered', device: existing } });
    }

    const newDevice = {
      deviceId,
      label: label || 'Mobile Phone',
      approved: true, // Auto-approved for prototype
      registeredAt: new Date()
    };

    user.devices = user.devices || [];
    user.devices.push(newDevice);

    if (isConnected()) {
      await user.save();
    }

    await logAction({ actorId: user._id, action: 'DEVICE_REGISTERED', details: { deviceId }, req });

    res.json({ data: { message: 'Device registered successfully', device: newDevice } });
  } catch (err) {
    next(err);
  }
};
