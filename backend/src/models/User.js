const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  deviceId: { type: String, required: true },
  label: { type: String, default: 'Phone' },
  approved: { type: Boolean, default: false },
  registeredAt: { type: Date, default: Date.now }
}, { _id: false });

const userSchema = new mongoose.Schema({
  staffId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  department: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    required: true,
    enum: ['faculty', 'hod', 'storekeeper', 'admin'],
    default: 'faculty'
  },
  passwordHash: {
    type: String,
    required: true
  },
  mustChangePassword: {
    type: Boolean,
    default: false
  },
  phone: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  devices: [deviceSchema],
  active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);
