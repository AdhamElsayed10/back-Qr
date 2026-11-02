const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settings.controller');
const authMiddleware = require('../middleware/auth.middleware');

router.use(authMiddleware);

router.get('/', settingsController.getSettings);
router.put('/', settingsController.updateSettings);
router.get('/defaults', settingsController.getSettings);

module.exports = router;
