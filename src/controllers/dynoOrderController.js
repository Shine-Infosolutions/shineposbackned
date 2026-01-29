const TenantModelFactory = require('../models/TenantModelFactory');
const axios = require('axios');

const syncDynoOrders = async (req, res) => {
  try {
    const { resId } = req.body;
    const restaurantSlug = req.user?.restaurantSlug;

    if (!restaurantSlug) {
      return res.status(400).json({ error: 'Restaurant slug not found' });
    }

    if (!resId) {
      return res.status(400).json({ error: 'Restaurant ID required' });
    }

    const dynoApiUrl = process.env.DYNO_API_URL || 'http://localhost:32567';
    if (!process.env.DYNO_API_URL && process.env.NODE_ENV === 'production') {
      return res.status(503).json({ error: 'Sync not available in production' });
    }

    const dynoResponse = await axios.get(`${dynoApiUrl}/api/v1/zomato/orderHistory?restaurant_id=${resId}`);
    const orderIds = dynoResponse.data.pages[0]?.orders || [];

    const OrderModel = TenantModelFactory.getOrderModel(restaurantSlug);
    const stats = { synced: 0, skipped: 0 };

    for (const orderId of orderIds) {
      const existingOrder = await OrderModel.findOne({ orderNumber: orderId.toString() });
      
      if (existingOrder) {
        stats.skipped++;
        continue;
      }

      await OrderModel.create({
        orderNumber: orderId.toString(),
        tableNumber: 'Zomato',
        items: [],
        totalAmount: 0,
        status: 'PENDING',
        customerName: 'Zomato Order',
        createdAt: new Date()
      });
      
      stats.synced++;
    }

    res.json({ 
      success: true,
      message: 'Orders synced successfully',
      stats
    });
  } catch (error) {
    console.error('Dyno order sync error:', error);
    res.status(500).json({ error: 'Failed to sync orders' });
  }
};

module.exports = { syncDynoOrders };
