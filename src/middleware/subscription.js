const Restaurant = require('../models/Restaurant');
const checkSubscriptionExpiry = (restaurant) => {
  if (!restaurant.subscriptionEndDate) return false;
  return new Date() > new Date(restaurant.subscriptionEndDate);
};

const trackUsage = async (req, res, next) => {
  try {
    if (!req.user || !req.user.restaurantSlug) return next();

    const restaurant = await Restaurant.findOne({ slug: req.user.restaurantSlug })
      .select('isActive subscriptionEndDate').lean();
    if (!restaurant) return next();

    if (!restaurant.isActive) {
      return res.status(403).json({ error: 'Account is suspended. Please contact support.' });
    }

    if (checkSubscriptionExpiry(restaurant)) {
      return res.status(403).json({ 
        error: 'Subscription expired. Please renew your subscription.',
        expired: true
      });
    }

    next();
  } catch (error) {
    console.error('Usage tracking error:', error);
    next();
  }
};

const checkSubscriptionStatus = async (restaurantSlug) => {
  try {
    const restaurant = await Restaurant.findOne({ slug: restaurantSlug });
    if (!restaurant) return null;

    const now = new Date();
    const isExpired = checkSubscriptionExpiry(restaurant);
    const daysRemaining = restaurant.subscriptionEndDate 
      ? Math.ceil((new Date(restaurant.subscriptionEndDate) - now) / (1000 * 60 * 60 * 24))
      : null;

    return {
      restaurant,
      isExpired,
      daysRemaining,
      subscriptionEndDate: restaurant.subscriptionEndDate
    };
  } catch (error) {
    console.error('Check subscription status error:', error);
    return null;
  }
};

module.exports = {
  trackUsage,
  checkSubscriptionStatus,
  checkSubscriptionExpiry
};