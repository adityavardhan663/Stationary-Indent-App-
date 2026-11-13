const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  code: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    uppercase: true
  },
  category: {
    type: String,
    trim: true,
    default: 'General'
  },
  unit: {
    type: String,
    required: true,
    trim: true // ream, box, piece, packet, set
  },
  stock: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  reorderLevel: {
    type: Number,
    default: 5,
    min: 0
  },
  maxPerIndent: {
    type: Number,
    default: 10,
    min: 1
  },
  active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

itemSchema.index({ name: 'text', code: 'text' });

module.exports = mongoose.model('Item', itemSchema);
