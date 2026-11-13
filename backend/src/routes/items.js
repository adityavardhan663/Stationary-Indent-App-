const express = require('express');
const router = express.Router();
const itemsController = require('../controllers/items');
const protect = require('../middleware/protect');
const allow = require('../middleware/allow');

router.get('/', protect, itemsController.getItems);
router.post('/', protect, allow('storekeeper', 'admin'), itemsController.createItem);
router.patch('/:id', protect, allow('storekeeper', 'admin'), itemsController.updateItem);

module.exports = router;
