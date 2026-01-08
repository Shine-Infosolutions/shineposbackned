const express = require('express');
const { body } = require('express-validator');
const { 
  createInventoryItem, 
  getInventory, 
  updateInventoryItem, 
  restockItem, 
  getLowStockItems 
} = require('../controllers/inventoryController');
const auth = require('../middleware/auth');
const tenantMiddleware = require('../middleware/tenant');

const router = express.Router();

// Get all inventory items
router.get('/all', auth(['RESTAURANT_ADMIN', 'STAFF']), tenantMiddleware, getInventory);

// Get low stock items
router.get('/low-stock', auth(['RESTAURANT_ADMIN', 'STAFF']), tenantMiddleware, getLowStockItems);

// Create inventory item
router.post('/', 
  auth(['RESTAURANT_ADMIN']),
  tenantMiddleware,
  [
    body('name').trim().isLength({ min: 1 }).withMessage('Name is required'),
    body('category').isIn(['ingredient', 'beverage', 'packaging', 'other']).withMessage('Valid category is required'),
    body('currentStock').isNumeric().withMessage('Current stock must be a number'),
    body('minStock').isNumeric().withMessage('Min stock must be a number'),
    body('unit').isIn(['kg', 'g', 'l', 'ml', 'pieces', 'boxes']).withMessage('Valid unit is required'),
    body('costPerUnit').isNumeric().withMessage('Cost per unit must be a number')
  ],
  createInventoryItem
);

// Update inventory item
router.put('/:id', auth(['RESTAURANT_ADMIN']), tenantMiddleware, updateInventoryItem);

// Restock item
router.patch('/:id/restock', 
  auth(['RESTAURANT_ADMIN', 'STAFF']), 
  tenantMiddleware,
  [
    body('quantity').isNumeric().withMessage('Quantity must be a number')
  ],
  restockItem
);

module.exports = router;