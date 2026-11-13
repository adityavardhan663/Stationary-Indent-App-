const express = require('express');
const router = express.Router();
const protect = require('../middleware/protect');
const allow = require('../middleware/allow');
const { isConnected } = require('../config/db');
const AuditLog = require('../models/AuditLog');
const { mem } = require('../services/store');

router.get('/', protect, allow('admin'), async (req, res, next) => {
  try {
    let logs = [];
    if (isConnected()) {
      logs = await AuditLog.find()
        .populate('actor', 'name staffId role')
        .sort({ at: -1 })
        .limit(100);
    } else {
      logs = mem.auditLogs.map(l => {
        const u = mem.users.find(u => u._id === l.actor);
        return {
          ...l,
          actor: u ? { name: u.name, staffId: u.staffId, role: u.role } : l.actor
        };
      });
    }
    res.json({ data: logs });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
