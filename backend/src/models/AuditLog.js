const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  actor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  action: {
    type: String,
    required: true,
    index: true // LOGIN_SUCCESS, LOGIN_FAIL, INDENT_CREATE, INDENT_ISSUE, etc.
  },
  details: {
    type: mongoose.Schema.Types.Mixed
  },
  ip: {
    type: String
  },
  userAgent: {
    type: String
  },
  deviceId: {
    type: String
  },
  at: {
    type: Date,
    default: Date.now,
    index: true
  }
});

auditLogSchema.index({ action: 1, at: -1 });
auditLogSchema.index({ actor: 1, at: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
