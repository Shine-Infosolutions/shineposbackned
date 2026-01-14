const express = require('express');
const { body } = require('express-validator');
const { activityLogger } = require('../middleware/activityLogger');
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

router.get('/all/inventory/items', auth(['RESTAURANT_ADMIN', 'STAFF']), tenantMiddleware, activityLogger('Inventory'), getInventory);
router.get('/all/low-stock', auth(['RESTAURANT_ADMIN', 'STAFF']), tenantMiddleware, activityLogger('Inventory'), getLowStockItems);
router.post('/add', auth(['RESTAURANT_ADMIN']), tenantMiddleware, activityLogger('Inventory'), [
  body('name').trim().isLength({ min: 1 }).withMessage('Name is required'),
  body('category').isIn(['ingredient', 'beverage', 'packaging', 'other']).withMessage('Valid category is required'),
  body('currentStock').isNumeric().withMessage('Current stock must be a number'),
  body('minStock').isNumeric().withMessage('Min stock must be a number'),
  body('unit').isIn(['kg', 'g', 'l', 'ml', 'pieces', 'boxes']).withMessage('Valid unit is required'),
  body('costPerUnit').isNumeric().withMessage('Cost per unit must be a number')
], createInventoryItem);
router.put('/update/item/:id', auth(['RESTAURANT_ADMIN']), tenantMiddleware, activityLogger('Inventory'), updateInventoryItem);
router.patch('/update/restock/:id', auth(['RESTAURANT_ADMIN', 'STAFF']), tenantMiddleware, activityLogger('Inventory'), [
  body('quantity').isNumeric().withMessage('Quantity must be a number')
], restockItem);

module.exports = router;