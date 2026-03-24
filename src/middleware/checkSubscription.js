const Restaurant = require('../models/Restaurant');

// Cache subscription status per restaurantId for 60 seconds
const cache = new Map();
const CACHE_TTL = 60 * 1000;
const CACHE_MAX_SIZE = 500;

const checkSubscription = async (req, res, next) => {
  try {
    const role = req.user?.role;
    if (role === 'SUPER_ADMIN') return next();

    const restaurantId = req.user?.userId;
    if (!restaurantId || role !== 'RESTAURANT_ADMIN') return next();

    // Check cache first
    const cached = cache.get(restaurantId);
    if (cached && Date.now() < cached.expiresAt) {
      if (!cached.valid) {
        return res.status(403).json({ error: 'Subscription expired or inactive' });
      }
      return next();
    }

    // Cache miss — hit DB
    const restaurant = await Restaurant.findById(restaurantId).select('subscriptionEndDate paymentStatus').lean();
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });

    const now = new Date();
    const valid = !(
      (restaurant.subscriptionEndDate && new Date(restaurant.subscriptionEndDate) < now) ||
      restaurant.paymentStatus === 'cancelled' ||
      restaurant.paymentStatus !== 'paid'
    );

    cache.set(restaurantId, { valid, expiresAt: Date.now() + CACHE_TTL });
    if (cache.size > CACHE_MAX_SIZE) cache.delete(cache.keys().next().value);

    if (!valid) {
      return res.status(403).json({
        error: 'Subscription expired or inactive',
        message: 'Your subscription has expired. Please renew to continue.',
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
