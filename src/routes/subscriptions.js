const express = require('express');
const router = express.Router();
const { getAllSubscriptions, extendSubscription, convertToSubscription, getRestaurantSubscription } = require('../controllers/subscriptionController');
const auth = require('../middleware/auth');

router.get('/all', auth(['SUPER_ADMIN']), getAllSubscriptions);
router.get('/restaurants/:restaurantId', getRestaurantSubscription);
router.patch('/restaurants/:restaurantId/extend', auth(['SUPER_ADMIN']), extendSubscription);
router.post('/restaurants/:restaurantId/convert', auth(['SUPER_ADMIN']), convertToSubscription);

module.exports = router;