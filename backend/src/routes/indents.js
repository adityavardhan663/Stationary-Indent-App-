const express = require('express');
const router = express.Router();
const indentsController = require('../controllers/indents');
const protect = require('../middleware/protect');
const allow = require('../middleware/allow');

router.post('/', protect, allow('faculty', 'hod', 'admin'), indentsController.createIndent);
router.get('/mine', protect, indentsController.getMyIndents);
router.get('/', protect, allow('storekeeper', 'admin', 'hod'), indentsController.getAllIndents);
router.patch('/:id/issue', protect, allow('storekeeper', 'admin'), indentsController.issueIndent);
router.patch('/:id/approve', protect, allow('hod', 'admin'), indentsController.approveIndent);
router.patch('/:id/cancel', protect, indentsController.cancelIndent);

module.exports = router;
