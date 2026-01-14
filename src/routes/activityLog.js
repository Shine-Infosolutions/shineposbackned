const express = require('express');
const auth = require('../middleware/auth');
const { getActivityLogs, getUserActivityLogs } = require('../controllers/activityLogController');

const router = express.Router();

// Get all activity logs (admin only)
router.get('/logs', auth(['RESTAURANT_ADMIN']), getActivityLogs);

// Get user specific activity logs
router.get('/logs/user/:userId', auth(['RESTAURANT_ADMIN']), getUserActivityLogs);

module.exports = router;