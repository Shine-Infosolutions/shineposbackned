const express = require('express');
const { body } = require('express-validator');
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

// Get all staff
router.get('/', auth(['RESTAURANT_ADMIN', 'MANAGER']), tenantMiddleware, getStaff);

// Create staff
router.post('/', 
  auth(['RESTAURANT_ADMIN']),
  trackUsage, // Check user limits
  tenantMiddleware,
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('name').trim().isLength({ min: 1 }).withMessage('Name is required'),
    body('role').isIn(['RESTAURANT_ADMIN', 'MANAGER', 'CASHIER', 'KITCHEN_STAFF']).withMessage('Valid role is required')
  ],
  createStaff
);

// Update staff
router.put('/:id', auth(['RESTAURANT_ADMIN', 'MANAGER']), tenantMiddleware, updateStaff);

// Schedule shift
router.post('/:id/shifts', 
  auth(['RESTAURANT_ADMIN', 'MANAGER']), 
  tenantMiddleware,
  [
    body('date').isISO8601().withMessage('Valid date is required'),
    body('startTime').notEmpty().withMessage('Start time is required'),
    body('endTime').notEmpty().withMessage('End time is required')
  ],
  scheduleShift
);

// Update performance
router.patch('/:id/performance', 
  auth(['RESTAURANT_ADMIN', 'MANAGER']), 
  tenantMiddleware,
  updatePerformance
);

module.exports = router;