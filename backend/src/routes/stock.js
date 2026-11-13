const express = require('express');
const router = express.Router();
const stockController = require('../controllers/stock');
const protect = require('../middleware/protect');
const allow = require('../middleware/allow');

router.post('/in', protect, allow('storekeeper', 'admin'), stockController.stockIn);
router.post('/adjust', protect, allow('storekeeper', 'admin'), stockController.adjustStock);
router.get('/ledger', protect, allow('storekeeper', 'admin'), stockController.getLedger);

module.exports = router;
