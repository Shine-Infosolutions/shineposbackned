const express = require('express');
const { body } = require('express-validator');
const { createMenu, getMenus, updateMenu, deleteMenu } = require('../controllers/menuController');
const auth = require('../middleware/auth');
const { trackUsage } = require('../middleware/subscription');

const router = express.Router();

// All menu routes require restaurant admin or staff access
router.use(auth(['RESTAURANT_ADMIN', 'MANAGER', 'CHEF', 'WAITER', 'CASHIER']));

// Create menu item
router.post('/',
  trackUsage, // Check subscription limits
  [
    body('name').trim().isLength({ min: 2 }).withMessage('Menu name must be at least 2 characters'),
    body('price').isNumeric().withMessage('Price must be a number'),
    body('category').trim().isLength({ min: 2 }).withMessage('Category is required')
  ],
  createMenu
);

// Get all menu items
router.get('/all', getMenus);

// Update menu item
router.put('/:id', updateMenu);

// Delete menu item
router.delete('/:id', deleteMenu);

module.exports = router;