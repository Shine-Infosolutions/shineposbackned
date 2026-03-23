const express = require('express');
const { getDashboardStats, getPeakHours } = require('../controllers/dashboardController');
const { getAdminDashboard, getStaffPerformance, getOvertimeStats, getAttendanceStats, getSalaryStats } = require('../controllers/adminDashboardController');
const auth = require('../middleware/auth');
const checkSubscription = require('../middleware/checkSubscription');
const tenantMiddleware = require('../middleware/tenant');

const router = express.Router();

router.get('/stats', auth(['RESTAURANT_ADMIN', 'MANAGER', 'CHEF', 'WAITER', 'CASHIER']), checkSubscription, getDashboardStats);
router.get('/peak-hours', auth(['RESTAURANT_ADMIN', 'MANAGER']), checkSubscription, getPeakHours);

// Admin Dashboard
router.get('/admin', auth(['RESTAURANT_ADMIN']), checkSubscription, tenantMiddleware, getAdminDashboard);
router.get('/staff-performance', auth(['RESTAURANT_ADMIN', 'MANAGER']), checkSubscription, tenantMiddleware, getStaffPerformance);
router.get('/overtime-stats', auth(['RESTAURANT_ADMIN', 'MANAGER']), checkSubscription, tenantMiddleware, getOvertimeStats);
router.get('/attendance-stats', auth(['RESTAURANT_ADMIN', 'MANAGER']), checkSubscription, tenantMiddleware, getAttendanceStats);
router.get('/salary-stats', auth(['RESTAURANT_ADMIN']), checkSubscription, tenantMiddleware, getSalaryStats);

module.exports = router;
