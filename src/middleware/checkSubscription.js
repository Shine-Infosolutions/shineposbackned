const Restaurant = require('../models/Restaurant');

const checkSubscription = async (req, res, next) => {
  try {
    // Only check for restaurant admin and staff roles
    const role = req.user?.role;
    if (role === 'SUPER_ADMIN') {
      return next(); // Super admin can always access
    }

    // Get restaurant ID from token
    const restaurantId = req.user?.userId;
    if (!restaurantId || role !== 'RESTAURANT_ADMIN') {
      return next(); // No restaurant context or not restaurant admin, skip check
    }

    // Find restaurant by ID
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    // Check subscription status
    const now = new Date();
    const isExpired = restaurant.subscriptionEndDate && new Date(restaurant.subscriptionEndDate) < now;
    const isCancelled = restaurant.paymentStatus === 'cancelled';
    const isInactive = restaurant.paymentStatus !== 'paid';

    if (isExpired || isCancelled || isInactive) {
      return res.status(403).json({ 
        error: 'Subscription expired or inactive',
        message: 'Your subscription has expired or been cancelled. Please renew to continue using the service.',
        subscriptionStatus: restaurant.paymentStatus,
        subscriptionEndDate: restaurant.subscriptionEndDate
      });
    }

    next();
  } catch (error) {
    console.error('Subscription check error:', error);
    res.status(500).json({ error: 'Failed to verify subscription status' });
  }
};

module.exports = checkSubscription;
