const Restaurant = require("../models/Restaurant");

const getAllSubscriptions = async (req, res) => {
  try {
    const restaurants = await Restaurant.find().select('name slug subscriptionStartDate subscriptionEndDate subscriptionPlan').sort({ createdAt: -1 }).lean();
    const now = new Date();
    const subscriptions = restaurants.map((restaurant) => {
      const isExpired = restaurant.subscriptionEndDate && new Date(restaurant.subscriptionEndDate) < now;
      const daysRemaining = restaurant.subscriptionEndDate
        ? Math.ceil((new Date(restaurant.subscriptionEndDate) - now) / (1000 * 60 * 60 * 24))
        : null;
      return {
        _id: restaurant._id, name: restaurant.name, slug: restaurant.slug,
        subscriptionStartDate: restaurant.subscriptionStartDate,
        subscriptionEndDate: restaurant.subscriptionEndDate,
        daysRemaining, isExpired, status: restaurant.subscriptionPlan || "trial",
      };
    });
    res.json({ subscriptions });
  } catch (error) {
    console.error("Get subscriptions error:", error);
    res.status(500).json({ error: "Failed to fetch subscriptions" });
  }
};

const extendSubscription = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { days } = req.body;
    if (!days || days <= 0) return res.status(400).json({ error: "Invalid number of days" });

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) return res.status(404).json({ error: "Restaurant not found" });

    const now = new Date();
    const currentEndDate = restaurant.subscriptionEndDate ? new Date(restaurant.subscriptionEndDate) : now;
    const baseDate = currentEndDate > now ? currentEndDate : now;
    restaurant.subscriptionEndDate = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);
    if (!restaurant.subscriptionStartDate) restaurant.subscriptionStartDate = now;
    await restaurant.save();

    res.json({ message: "Subscription extended successfully", restaurant });
  } catch (error) {
    console.error("Extend subscription error:", error);
    res.status(500).json({ error: "Failed to extend subscription" });
  }
};

const startTrialSubscription = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) return res.status(404).json({ error: "Restaurant not found" });

    const now = new Date();
    restaurant.subscriptionPlan = "trial";
    restaurant.subscriptionStartDate = now;
    restaurant.subscriptionEndDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    await restaurant.save();

    res.json({
      message: "14-day trial started successfully",
      subscription: {
        restaurantId: restaurant._id, name: restaurant.name,
        subscriptionStartDate: restaurant.subscriptionStartDate,
        subscriptionEndDate: restaurant.subscriptionEndDate, status: "trial",
      },
    });
  } catch (error) {
    console.error("Start trial error:", error);
    res.status(500).json({ error: "Failed to start trial" });
  }
};

const convertToSubscription = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) return res.status(404).json({ error: "Restaurant not found" });

    const now = new Date();
    restaurant.subscriptionPlan = "subscription";
    restaurant.subscriptionStartDate = now;
    restaurant.subscriptionEndDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    await restaurant.save();

    res.json({ message: "Converted to 30-day subscription successfully", restaurant });
  } catch (error) {
    console.error("Convert to subscription error:", error);
    res.status(500).json({ error: "Failed to convert to subscription" });
  }
};

const activateSubscriptionAfterPayment = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) return res.status(404).json({ error: "Restaurant not found" });

    const now = new Date();
    restaurant.subscriptionPlan = "subscription";
    restaurant.subscriptionStartDate = now;
    restaurant.subscriptionEndDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    await restaurant.save();

    res.json({
      message: "30-day subscription activated successfully",
      subscription: {
        restaurantId: restaurant._id, name: restaurant.name,
        subscriptionStartDate: restaurant.subscriptionStartDate,
        subscriptionEndDate: restaurant.subscriptionEndDate, status: "active",
      },
    });
  } catch (error) {
    console.error("Activate subscription error:", error);
    res.status(500).json({ error: "Failed to activate subscription" });
  }
};

const getRestaurantSubscription = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const restaurant = await Restaurant.findById(restaurantId).select('name slug subscriptionStartDate subscriptionEndDate').lean();
    if (!restaurant) return res.status(404).json({ error: "Restaurant not found" });

    const now = new Date();
    const isExpired = restaurant.subscriptionEndDate && new Date(restaurant.subscriptionEndDate) < now;
    const daysRemaining = restaurant.subscriptionEndDate
      ? Math.ceil((new Date(restaurant.subscriptionEndDate) - now) / (1000 * 60 * 60 * 24))
      : null;

    res.json({
      subscription: {
        restaurantId: restaurant._id, name: restaurant.name, slug: restaurant.slug,
        subscriptionStartDate: restaurant.subscriptionStartDate,
        subscriptionEndDate: restaurant.subscriptionEndDate,
        daysRemaining, isExpired, status: isExpired ? "expired" : "active",
      },
    });
  } catch (error) {
    console.error("Get restaurant subscription error:", error);
    res.status(500).json({ error: "Failed to fetch subscription" });
  }
};

module.exports = {
  getAllSubscriptions,
  extendSubscription,
  startTrialSubscription,
  convertToSubscription,
  activateSubscriptionAfterPayment,
  getRestaurantSubscription,
};
