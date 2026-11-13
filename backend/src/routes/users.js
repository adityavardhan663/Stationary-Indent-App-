const express = require('express');
const router = express.Router();
const usersController = require('../controllers/users');
const protect = require('../middleware/protect');
const allow = require('../middleware/allow');

router.get('/', protect, allow('admin'), usersController.getUsers);
router.post('/', protect, allow('admin'), usersController.createUser);
router.patch('/:id', protect, allow('admin'), usersController.updateUser);
router.patch('/:id/devices/:deviceId', protect, allow('admin'), usersController.approveDevice);
router.post('/:id/reset-password', protect, allow('admin'), usersController.resetPassword);

module.exports = router;
