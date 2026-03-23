const express = require('express');
const { body } = require('express-validator');
const { activityLogger } = require('../middleware/activityLogger');
const {
  checkIn,
  checkOut,
  getMyAttendance,
  getTodayAttendance,
  markAttendance,
  getAllAttendance,
  getStaffAttendanceByDate,
  checkEarlyLeaveEligibility,
  approveEarlyLeave
} = require('../controllers/attendanceController');
const {
  scheduleShift,
  updatePerformance
} = require('../controllers/staffController');
const auth = require('../middleware/auth');
const checkSubscription = require('../middleware/checkSubscription');
const tenantMiddleware = require('../middleware/tenant');

const router = express.Router();

// Staff check-in/out
router.post('/checkin/:id', 
  auth(['RESTAURANT_ADMIN', 'MANAGER', 'CHEF', 'WAITER', 'CASHIER']), 
  checkSubscription, 
  tenantMiddleware, 
  activityLogger('Attendance'),
  checkIn
);

router.post('/checkout/:id', 
  auth(['RESTAURANT_ADMIN', 'MANAGER', 'CHEF', 'WAITER', 'CASHIER']), 
  checkSubscription, 
  tenantMiddleware, 
  activityLogger('Attendance'),
  checkOut
);

// Staff's own attendance view
router.get('/my-attendance', 
  auth(['RESTAURANT_ADMIN', 'MANAGER', 'CHEF', 'WAITER', 'CASHIER']), 
  checkSubscription, 
  tenantMiddleware, 
  getMyAttendance
);

// Admin views
router.get('/all', 
  auth(['RESTAURANT_ADMIN', 'MANAGER']), 
  checkSubscription, 
  tenantMiddleware, 
  getAllAttendance
);

router.get('/today', 
  auth(['RESTAURANT_ADMIN', 'MANAGER']), 
  checkSubscription, 
  tenantMiddleware, 
  getTodayAttendance
);

router.post('/mark/:id', 
  auth(['RESTAURANT_ADMIN', 'MANAGER']), 
  checkSubscription, 
  tenantMiddleware, 
  activityLogger('Attendance'),
  [
    body('date').isISO8601().withMessage('Valid date required'),
    body('status').isIn(['present', 'absent', 'late', 'half-day', 'on-leave']).withMessage('Valid status required')
  ],
  markAttendance
);

// Shift scheduling
router.post('/schedule-shift/:id',
  auth(['RESTAURANT_ADMIN', 'MANAGER']),
  checkSubscription,
  tenantMiddleware,
  activityLogger('Shift Schedule'),
  [
    body('date').isISO8601().withMessage('Valid date required'),
    body('startTime').notEmpty().withMessage('Start time required'),
    body('endTime').notEmpty().withMessage('End time required')
  ],
  scheduleShift
);

// Performance tracking
router.put('/performance/:id',
  auth(['RESTAURANT_ADMIN', 'MANAGER']),
  checkSubscription,
  tenantMiddleware,
  activityLogger('Performance Update'),
  updatePerformance
);

router.get('/staff/:staffId', 
  auth(['RESTAURANT_ADMIN', 'MANAGER']), 
  checkSubscription, 
  tenantMiddleware, 
  getStaffAttendanceByDate
);

// Early leave management
router.get('/early-leave-eligibility/:id',
  auth(['RESTAURANT_ADMIN', 'MANAGER', 'CHEF', 'WAITER', 'CASHIER']),
  checkSubscription,
  tenantMiddleware,
  checkEarlyLeaveEligibility
);

router.post('/approve-early-leave/:id',
  auth(['RESTAURANT_ADMIN', 'MANAGER']),
  checkSubscription,
  tenantMiddleware,
  activityLogger('Early Leave Approval'),
  approveEarlyLeave
);

module.exports = router;