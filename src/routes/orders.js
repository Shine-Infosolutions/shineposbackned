const express = require('express');
const { body } = require('express-validator');
const { getOrders, createOrder, updateOrderStatus } = require('../controllers/orderController');
const auth = require('../middleware/auth');

const router = express.Router();

// Create order for authenticated staff
router.post('/',
  auth(['RESTAURANT_ADMIN', 'MANAGER', 'CHEF', 'WAITER', 'CASHIER']),
  [
    body('items').isArray({ min: 1 }).withMessage('Items are required'),
    body('customerName').isLength({ min: 1 }).withMessage('Customer name is required'),
    body('customerPhone').optional().isMobilePhone()
  ],
  createOrder
);

// All other order routes require restaurant admin or staff access
router.use(auth(['RESTAURANT_ADMIN', 'MANAGER', 'CHEF', 'WAITER', 'CASHIER']));

// Get all orders
router.get('/', getOrders);

// Update order status
router.patch('/:id/status', updateOrderStatus);

module.exports = router;