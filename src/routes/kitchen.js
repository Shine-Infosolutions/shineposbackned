const express = require('express');
const { 
  getKitchenOrders, 
  updateOrderStatus, 
  setPriority,
  printOrderKOT,
  updateKOTStatus
} = require('../controllers/kitchenController');
const auth = require('../middleware/auth');
const tenantMiddleware = require('../middleware/tenant');

const router = express.Router();

// Get kitchen orders
router.get('/all/kitchen/orders', auth(['KITCHEN_STAFF', 'MANAGER', 'RESTAURANT_ADMIN']), tenantMiddleware, getKitchenOrders);

// Update order status
router.patch('/update/orders/status/:id', auth(['KITCHEN_STAFF', 'MANAGER', 'RESTAURANT_ADMIN']), tenantMiddleware, updateOrderStatus);

// Update KOT status
router.patch('/update/kot/status/:id', auth(['KITCHEN_STAFF', 'MANAGER', 'RESTAURANT_ADMIN']), tenantMiddleware, updateKOTStatus);

// Set order priority
router.patch('/update/orders/priority/:id', auth(['MANAGER', 'RESTAURANT_ADMIN']), tenantMiddleware, setPriority);

// Print KOT for order
router.post('/orders/:id/print-kot', auth(['KITCHEN_STAFF', 'MANAGER', 'RESTAURANT_ADMIN']), tenantMiddleware, printOrderKOT);

module.exports = router;