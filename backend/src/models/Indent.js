const mongoose = require('mongoose');

const indentItemSchema = new mongoose.Schema({
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: true
  },
  nameSnapshot: {
    type: String,
    required: true
  },
  unit: {
    type: String,
    required: true
  },
  qtyRequested: {
    type: Number,
    required: true,
    min: 1
  },
  qtyIssued: {
    type: Number,
    default: 0,
    min: 0
  }
}, { _id: false });

const confirmationSchema = new mongoose.Schema({
  method: {
    type: String,
    enum: ['biometric', 'pin', 'assisted'],
    default: 'biometric'
  },
  at: {
    type: Date,
    default: Date.now
  },
  deviceId: {
    type: String
  }
}, { _id: false });

const indentSchema = new mongoose.Schema({
  indentNo: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  requester: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  department: {
    type: String,
    required: true,
    index: true
  },
  items: {
    type: [indentItemSchema],
    validate: [v => Array.isArray(v) && v.length > 0, 'Indent must contain at least one item']
  },
  status: {
    type: String,
    enum: ['REQUESTED', 'APPROVED', 'ISSUED', 'REJECTED', 'CANCELLED'],
    default: 'REQUESTED',
    index: true
  },
  confirmation: confirmationSchema,
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  issuedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  issuedAt: {
    type: Date
  },
  urgency: {
    type: String,
    enum: ['Urgent', 'Normal', 'Not urgent']
  },
  neededWithin: {
    type: String,
    trim: true
  },
  neededBy: {
    type: Date
  },
  purpose: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  remarks: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

indentSchema.index({ requester: 1, createdAt: -1 });
indentSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Indent', indentSchema);
