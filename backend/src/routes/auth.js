const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth');
const protect = require('../middleware/protect');

router.post('/login', authController.login);
router.post('/change-password', protect, authController.changePassword);
router.get('/me', protect, authController.getMe);
router.post('/me/devices', protect, authController.registerDevice);

module.exports = router;
