const express = require('express');
const { getSettings, updateSetting, deleteSetting } = require('../controllers/settingsController');
const auth = require('../middleware/auth');

const router = express.Router();

// All settings routes require super admin access
router.use(auth(['SUPER_ADMIN']));

// Get all settings
router.get('/', getSettings);

// Update setting
router.put('/', updateSetting);

// Delete setting
router.delete('/:key', deleteSetting);

module.exports = router;