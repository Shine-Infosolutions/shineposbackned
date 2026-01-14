const express = require('express');
const auth = require('../middleware/auth');
const tenantMiddleware = require('../middleware/tenant');
const { activityLogger } = require('../middleware/activityLogger');
const {
    createMenuItem,
    getMenuItems,
    getMenuItemById,
    updateMenuItem,
    deleteMenuItem
} = require('../controllers/menuItemController');

const router = express.Router();

// Create new menu item
router.post('/create/menu-item', auth(['RESTAURANT_ADMIN']), tenantMiddleware, activityLogger('MenuItem'), createMenuItem);

// Get all menu items for restaurant
router.get('/get/all-menu-items', auth(['RESTAURANT_ADMIN', 'SUPER_ADMIN']), tenantMiddleware, activityLogger('MenuItem'), getMenuItems);

// Get specific menu item by ID
router.get('/get/menu-item/:id', auth(['RESTAURANT_ADMIN']), tenantMiddleware, activityLogger('MenuItem'), getMenuItemById);

// Update existing menu item
router.put('/update/menu-item/:id', auth(['RESTAURANT_ADMIN']), tenantMiddleware, activityLogger('MenuItem'), updateMenuItem);

// Delete menu item permanently
router.delete('/delete/menu-item/:id', auth(['RESTAURANT_ADMIN']), tenantMiddleware, activityLogger('MenuItem'), deleteMenuItem);

module.exports = router;