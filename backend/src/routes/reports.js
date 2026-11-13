const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reports');
const protect = require('../middleware/protect');
const allow = require('../middleware/allow');

router.get('/low-stock', protect, allow('storekeeper', 'admin'), reportsController.getLowStock);
router.get('/monthly', protect, allow('storekeeper', 'admin'), reportsController.getMonthlySummary);
router.get('/export.csv', protect, allow('storekeeper', 'admin'), reportsController.exportCsv);

module.exports = router;
