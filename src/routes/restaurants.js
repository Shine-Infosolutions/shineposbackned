const express = require('express');
const { body } = require('express-validator');
const { createRestaurant, getRestaurants, getRestaurantAnalytics, updateRestaurant, deleteRestaurant, toggleRestaurantStatus } = require('../controllers/restaurantController');
const auth = require('../middleware/auth');

const router = express.Router();

// Create restaurant
router.post('/', 
  [
    body('name').trim().isLength({ min: 2 }).withMessage('Restaurant name is required'),
    body('adminName').trim().isLength({ min: 2 }).withMessage('Owner name is required'),
    body('adminEmail').isEmail().withMessage('Valid email is required'),
    body('adminPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('slug').trim().isLength({ min: 2 }).withMessage('Restaurant slug is required'),
    body('phone').trim().isLength({ min: 10 }).withMessage('Phone number is required'),
    body('restaurantPhone').trim().isLength({ min: 10 }).withMessage('Restaurant phone number is required'),
    body('pinCode').trim().isLength({ min: 5 }).withMessage('Pin code is required'),
    body('city').trim().notEmpty().withMessage('City is required'),
    body('state').trim().notEmpty().withMessage('State is required'),
    body('address').trim().notEmpty().withMessage('Address is required')
  ],
  createRestaurant
);

// Get all restaurants (Super Admin only)
router.get('/all', auth(['SUPER_ADMIN']), getRestaurants);

// Get restaurant analytics (Super Admin only)
router.get('/analytics', auth(['SUPER_ADMIN']), getRestaurantAnalytics);

// Update restaurant (Super Admin only)
router.put('/:id', auth(['SUPER_ADMIN']), updateRestaurant);

// Delete restaurant (Super Admin only)
router.delete('/:id', auth(['SUPER_ADMIN']), deleteRestaurant);

// Toggle restaurant status (Super Admin only)
router.patch('/:id/toggle-status', auth(['SUPER_ADMIN']), toggleRestaurantStatus);

module.exports = router;