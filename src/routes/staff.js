const express = require('express');
const { body } = require('express-validator');
const { activityLogger } = require('../middleware/activityLogger');
const { 
  createStaff, 
  getStaff, 
  updateStaff, 
  scheduleShift, 
  updatePerformance,
  assignOvertime,
  respondToOvertime,
  getMyOvertimeRequests,
  setOvertimeRate,
  addOvertimeRecord,
  getOvertimeRecords,
  getOvertimeResponses,
  getStaffOvertimeRecords,
  completeOvertime,
  updateOvertimeHours
} = require('../controllers/staffController');
const auth = require('../middleware/auth');
const checkSubscription = require('../middleware/checkSubscription');
const tenantMiddleware = require('../middleware/tenant');
const { trackUsage } = require('../middleware/subscription');

const router = express.Router();

router.get('/test', (req, res) => {
  res.json({ message: 'Staff routes loaded' });
});

router.get('/all/staff', auth(['RESTAURANT_ADMIN', 'MANAGER']), checkSubscription, tenantMiddleware, activityLogger('Staff'), getStaff);
router.get('/overtime-responses', auth(['RESTAURANT_ADMIN', 'MANAGER']), checkSubscription, tenantMiddleware, getOvertimeResponses);
router.post('/add/staff', auth(['RESTAURANT_ADMIN']), checkSubscription, trackUsage, tenantMiddleware, activityLogger('Staff'), [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('name').trim().isLength({ min: 1 }).withMessage('Name is required'),
  body('role').isIn(['MANAGER', 'CHEF', 'WAITER', 'CASHIER']).withMessage('Valid role is required')
], createStaff);
router.put('/update/staff/:id', auth(['RESTAURANT_ADMIN']), checkSubscription, tenantMiddleware, activityLogger('Staff'), updateStaff);
router.post('/add/:id/shifts', auth(['RESTAURANT_ADMIN', 'MANAGER']), checkSubscription, tenantMiddleware, activityLogger('Shift'), [
  body('date').isISO8601().withMessage('Valid date is required'),
  body('startTime').notEmpty().withMessage('Start time is required'),
  body('endTime').notEmpty().withMessage('End time is required')
], scheduleShift);
router.patch('/update/performance/:id', auth(['RESTAURANT_ADMIN', 'MANAGER']), checkSubscription, tenantMiddleware, activityLogger('Performance'), updatePerformance);
router.post('/assign-overtime/:id', auth(['RESTAURANT_ADMIN', 'MANAGER']), checkSubscription, tenantMiddleware, activityLogger('Overtime'), assignOvertime);
router.patch('/overtime/:requestId/respond', auth(['MANAGER', 'CHEF', 'WAITER', 'CASHIER']), checkSubscription, tenantMiddleware, respondToOvertime);
router.get('/my-overtime', auth(['RESTAURANT_ADMIN', 'MANAGER', 'CHEF', 'WAITER', 'CASHIER']), getMyOvertimeRequests);
router.patch('/set-overtime-rate/:id', auth(['RESTAURANT_ADMIN', 'MANAGER']), checkSubscription, tenantMiddleware, activityLogger('Overtime Rate'), setOvertimeRate);
router.post('/overtime-record/:id', auth(['RESTAURANT_ADMIN', 'MANAGER']), checkSubscription, tenantMiddleware, activityLogger('Overtime Record'), addOvertimeRecord);
router.patch('/overtime/:requestId/complete', auth(['RESTAURANT_ADMIN', 'MANAGER']), checkSubscription, tenantMiddleware, completeOvertime);
router.patch('/overtime/:requestId/update-hours', auth(['RESTAURANT_ADMIN', 'MANAGER']), checkSubscription, tenantMiddleware, updateOvertimeHours);
router.get('/staff-overtime-records/:staffId', auth(['RESTAURANT_ADMIN', 'MANAGER']), checkSubscription, tenantMiddleware, getStaffOvertimeRecords);

module.exports = router;
