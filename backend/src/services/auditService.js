const { isConnected } = require('../config/db');
const AuditLog = require('../models/AuditLog');
const { mem } = require('./store');

async function logAction({ actorId = null, action, details = {}, req = null }) {
  const ip = req ? (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || '') : '';
  const userAgent = req ? (req.headers['user-agent'] || '') : '';
  const deviceId = req?.body?.deviceId || req?.body?.confirmation?.deviceId || '';

  const logEntry = {
    _id: 'a' + Date.now() + Math.random().toString(36).substring(2, 6),
    actor: actorId,
    action,
    details,
    ip: String(ip),
    userAgent: String(userAgent),
    deviceId: String(deviceId),
    at: new Date()
  };

  mem.auditLogs.unshift(logEntry);

  if (isConnected()) {
    try {
      await AuditLog.create({
        actor: actorId,
        action,
        details,
        ip: logEntry.ip,
        userAgent: logEntry.userAgent,
        deviceId: logEntry.deviceId,
        at: logEntry.at
      });
    } catch (err) {
      console.warn('[Audit Warning] Could not persist to MongoDB:', err.message);
    }
  }

  return logEntry;
}

module.exports = { logAction };
