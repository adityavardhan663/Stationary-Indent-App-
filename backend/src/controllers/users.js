const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { isConnected } = require('../config/db');
const User = require('../models/User');
const { mem } = require('../services/store');
const { logAction } = require('../services/auditService');

exports.getUsers = async (req, res, next) => {
  try {
    let users = [];
    if (isConnected()) {
      users = await User.find().select('-passwordHash').sort({ name: 1 });
    } else {
      users = mem.users.map(({ passwordHash, ...u }) => u);
    }
    res.json({ data: users });
  } catch (err) {
    next(err);
  }
};

exports.createUser = async (req, res, next) => {
  try {
    const { staffId, name, department, role, email, phone, tempPassword } = req.body;
    if (!staffId || !name || !department) {
      return res.status(400).json({ message: 'Staff ID, Name, and Department are required' });
    }

    const cleanStaffId = staffId.trim().toUpperCase();
    const passwordHash = await bcrypt.hash(tempPassword || 'Password@123', 10);

    let newUser = null;

    if (isConnected()) {
      const existing = await User.findOne({ staffId: cleanStaffId });
      if (existing) return res.status(400).json({ message: 'User with this Staff ID already exists' });

      newUser = await User.create({
        staffId: cleanStaffId,
        name: name.trim(),
        department: department.trim(),
        role: role || 'faculty',
        email: email?.trim(),
        phone: phone?.trim(),
        passwordHash,
        mustChangePassword: true,
        devices: [],
        active: true
      });
    } else {
      const existing = mem.users.find(u => u.staffId === cleanStaffId);
      if (existing) return res.status(400).json({ message: 'User with this Staff ID already exists' });

      newUser = {
        _id: 'u' + Date.now(),
        staffId: cleanStaffId,
        name: name.trim(),
        department: department.trim(),
        role: role || 'faculty',
        email: email?.trim(),
        phone: phone?.trim(),
        passwordHash,
        mustChangePassword: true,
        devices: [],
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mem.users.push(newUser);
    }

    await logAction({
      actorId: req.user._id,
      action: 'USER_CREATED',
      details: { staffId: cleanStaffId, role: newUser.role },
      req
    });

    const { passwordHash: _, ...safeUser } = isConnected() ? newUser.toObject() : newUser;
    res.status(201).json({ data: safeUser });
  } catch (err) {
    next(err);
  }
};

exports.updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, department, role, active, email, phone } = req.body;

    let user = null;
    if (isConnected()) {
      user = await User.findByIdAndUpdate(
        id,
        { name, department, role, active, email, phone },
        { new: true }
      ).select('-passwordHash');
    } else {
      const idx = mem.users.findIndex(u => u._id === id);
      if (idx !== -1) {
        mem.users[idx] = { ...mem.users[idx], name, department, role, active, email, phone };
        const { passwordHash, ...safe } = mem.users[idx];
        user = safe;
      }
    }

    if (!user) return res.status(404).json({ message: 'User not found' });

    await logAction({
      actorId: req.user._id,
      action: 'USER_UPDATED',
      details: { targetUserId: id },
      req
    });

    res.json({ data: user });
  } catch (err) {
    next(err);
  }
};

exports.approveDevice = async (req, res, next) => {
  try {
    const { id, deviceId } = req.params;
    const { approved } = req.body || {};

    const cleanUserId = id ? String(id).trim() : '';
    const cleanDeviceId = deviceId ? String(deviceId).trim() : '';

    if (!cleanUserId || (isConnected() && !mongoose.Types.ObjectId.isValid(cleanUserId))) {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }

    if (!cleanDeviceId) {
      return res.status(400).json({ message: 'Valid deviceId is required' });
    }

    if (approved !== undefined && typeof approved !== 'boolean') {
      return res.status(400).json({ message: 'approved must be a boolean' });
    }

    const nextApproved = approved === undefined ? true : approved;

    let user = null;
    if (isConnected()) {
      user = await User.findById(cleanUserId);
    } else {
      user = mem.users.find(u => u._id === cleanUserId);
    }

    if (!user) return res.status(404).json({ message: 'User not found' });

    const device = Array.isArray(user.devices)
      ? user.devices.find(d => d.deviceId === cleanDeviceId)
      : null;
    if (!device) return res.status(404).json({ message: 'Device not found on user record' });

    device.approved = nextApproved;
    if (isConnected()) await user.save();

    await logAction({
      actorId: req.user._id,
      action: 'DEVICE_APPROVAL_CHANGE',
      details: { targetUserId: cleanUserId, deviceId: cleanDeviceId, approved: device.approved },
      req
    });

    res.json({
      data: {
        message: `Device ${device.approved ? 'approved' : 'revoked'}`,
        device: {
          deviceId: device.deviceId,
          label: device.label,
          approved: device.approved,
          registeredAt: device.registeredAt
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { tempPassword } = req.body;
    const newPass = tempPassword || 'Password@123';
    const hash = await bcrypt.hash(newPass, 10);

    let user = null;
    if (isConnected()) {
      user = await User.findById(id);
    } else {
      user = mem.users.find(u => u._id === id);
    }

    if (!user) return res.status(404).json({ message: 'User not found' });

    user.passwordHash = hash;
    user.mustChangePassword = true;

    if (isConnected()) await user.save();

    await logAction({
      actorId: req.user._id,
      action: 'PASSWORD_RESET_ADMIN',
      details: { targetUserId: id },
      req
    });

    res.json({ data: { message: `Temporary password set to: ${newPass}` } });
  } catch (err) {
    next(err);
  }
};
