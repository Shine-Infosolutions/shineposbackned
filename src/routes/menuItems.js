const express = require('express');
const auth = require('../middleware/auth');
const checkSubscription = require('../middleware/checkSubscription');
const tenantMiddleware = require('../middleware/tenant');
const upload = require('../config/multer');
const { activityLogger } = require('../middleware/activityLogger');
const {
    createMenuItem,
    getMenuItems,
    getMenuItemById,
    updateMenuItem,
    deleteMenuItem,
    uploadMenuMedia,
    getDigitalMenu
} = require('../controllers/menuItemController');

const router = express.Router();

// Upload media for menu item
router.post('/upload-media', auth(['RESTAURANT_ADMIN']), checkSubscription, tenantMiddleware, upload.single('file'), uploadMenuMedia);

// Get digital menu (public endpoint)
router.get('/digital-menu/:restaurantSlug', tenantMiddleware, getDigitalMenu);

// Create new menu item
router.post('/create/menu-item', auth(['RESTAURANT_ADMIN']), checkSubscription, tenantMiddleware, activityLogger('MenuItem'), createMenuItem);

// Get all menu items for restaurant
router.get('/get/all-menu-items', auth(['RESTAURANT_ADMIN', 'SUPER_ADMIN']), checkSubscription, tenantMiddleware, activityLogger('MenuItem'), getMenuItems);

// Get specific menu item by ID
router.get('/get/menu-item/:id', auth(['RESTAURANT_ADMIN']), checkSubscription, tenantMiddleware, activityLogger('MenuItem'), getMenuItemById);

// Update existing menu item
router.put('/update/menu-item/:id', auth(['RESTAURANT_ADMIN']), checkSubscription, tenantMiddleware, activityLogger('MenuItem'), updateMenuItem);

// Delete menu item permanently
router.delete('/delete/menu-item/:id', auth(['RESTAURANT_ADMIN']), checkSubscription, tenantMiddleware, activityLogger('MenuItem'), deleteMenuItem);

module.exports = router;