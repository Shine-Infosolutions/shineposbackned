const express = require('express');
const { body } = require('express-validator');
const { activityLogger } = require('../middleware/activityLogger');
const { 
  createStaff, 
  getStaff, 
  updateStaff, 
  scheduleShift, 
  updatePerformance 
} = require('../controllers/staffController');
const auth = require('../middleware/auth');
const tenantMiddleware = require('../middleware/tenant');
const { trackUsage } = require('../middleware/subscription');

const router = express.Router();

router.get('/all/staff', auth(['RESTAURANT_ADMIN', 'MANAGER']), tenantMiddleware, activityLogger('Staff'), getStaff);
router.post('/add/staff', auth(['RESTAURANT_ADMIN']), trackUsage, tenantMiddleware, activityLogger('Staff'), [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('name').trim().isLength({ min: 1 }).withMessage('Name is required'),
  body('role').isIn(['MANAGER', 'CHEF', 'WAITER', 'CASHIER']).withMessage('Valid role is required')
], createStaff);
router.put('/update/staff/:id', auth(['RESTAURANT_ADMIN', 'MANAGER']), tenantMiddleware, activityLogger('Staff'), updateStaff);
router.post('/add/:id/shifts', auth(['RESTAURANT_ADMIN', 'MANAGER']), tenantMiddleware, activityLogger('Shift'), [
  body('date').isISO8601().withMessage('Valid date is required'),
  body('startTime').notEmpty().withMessage('Start time is required'),
  body('endTime').notEmpty().withMessage('End time is required')
], scheduleShift);
router.patch('/update/performance/:id', auth(['RESTAURANT_ADMIN', 'MANAGER']), tenantMiddleware, activityLogger('Performance'), updatePerformance);

module.exports = router;