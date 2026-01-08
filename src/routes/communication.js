const express = require('express');
const { createMessage, getMessages, getRestaurantMessages, markAsRead } = require('../controllers/communicationController');
const auth = require('../middleware/auth');

const router = express.Router();

// Super admin routes
router.post('/', auth(['SUPER_ADMIN']), createMessage);
router.get('/', auth(['SUPER_ADMIN']), getMessages);

// Restaurant routes
router.get('/restaurants/:restaurantId/messages', auth(['RESTAURANT_ADMIN', 'STAFF']), getRestaurantMessages);
router.patch('/messages/:messageId/read', auth(['RESTAURANT_ADMIN', 'STAFF']), markAsRead);

module.exports = router;