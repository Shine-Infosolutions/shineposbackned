const Restaurant = require('../models/Restaurant');
const TenantModelFactory = require('../models/TenantModelFactory');
const ExpectedRevenue = require('../models/ExpectedRevenue');

const getAdvancedAnalytics = async (req, res) => {
  try {
    const restaurants = await Restaurant.find().lean();

    // Parallel queries across all restaurants
    const results = await Promise.all(restaurants.map(async (restaurant) => {
      try {
        const OrderModel = TenantModelFactory.getOrderModel(restaurant.slug);
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const orders = await OrderModel.find({ createdAt: { $gte: thirtyDaysAgo } }).select('totalAmount createdAt').lean();

        const restaurantRevenue = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
        const hourlyOrders = {};
        const dailyRevenue = {};

        orders.forEach(order => {
          const hour = new Date(order.createdAt).getHours();
          hourlyOrders[hour] = (hourlyOrders[hour] || 0) + 1;
          const day = new Date(order.createdAt).toDateString();
          dailyRevenue[day] = (dailyRevenue[day] || 0) + (order.totalAmount || 0);
        });

        return {
          restaurantId: restaurant._id,
          name: restaurant.name,
          slug: restaurant.slug,
          revenue: restaurantRevenue,
          orders: orders.length,
          averageOrderValue: orders.length > 0 ? restaurantRevenue / orders.length : 0,
          peakHour: Object.keys(hourlyOrders).reduce((a, b) => hourlyOrders[a] > hourlyOrders[b] ? a : b, '0'),
          dailyRevenue: Object.entries(dailyRevenue).map(([date, revenue]) => ({ date, revenue })),
          hourlyOrders
        };
      } catch {
        return { restaurantId: restaurant._id, name: restaurant.name, slug: restaurant.slug, revenue: 0, orders: 0, averageOrderValue: 0, peakHour: '0', dailyRevenue: [], hourlyOrders: {} };
      }
    }));

    const totalRevenue = results.reduce((s, r) => s + r.revenue, 0);
    const totalOrders = results.reduce((s, r) => s + r.orders, 0);

    const peakHours = {};
    results.forEach(r => {
      Object.entries(r.hourlyOrders || {}).forEach(([hour, count]) => {
        peakHours[hour] = (peakHours[hour] || 0) + count;
      });
    });

    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const dateStr = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toDateString();
      const dayRevenue = results.reduce((sum, r) => {
        const d = r.dailyRevenue.find(d => d.date === dateStr);
        return sum + (d ? d.revenue : 0);
      }, 0);
      last7Days.push({ date: dateStr, revenue: dayRevenue });
    }

    const analytics = {
      totalRevenue,
      totalOrders,
      restaurantPerformance: results,
      peakHours,
      revenueByDay: last7Days,
      topPerformingRestaurants: [...results].sort((a, b) => b.revenue - a.revenue).slice(0, 10)
    };

    res.json(analytics);
  } catch (error) {
    console.error('Advanced analytics error:', error);
    res.status(500).json({ error: 'Failed to get advanced analytics' });
  }
};

const exportReport = async (req, res) => {
  try {
    const { format = 'json' } = req.query;
    const restaurants = await Restaurant.find().lean();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const performance = await Promise.all(restaurants.map(async (restaurant) => {
      try {
        const OrderModel = TenantModelFactory.getOrderModel(restaurant.slug);
        const orders = await OrderModel.find({ createdAt: { $gte: thirtyDaysAgo } }).select('totalAmount').lean();
        const revenue = orders.reduce((s, o) => s + (o.totalAmount || 0), 0);
        return { name: restaurant.name, revenue, orders: orders.length, averageOrderValue: orders.length > 0 ? revenue / orders.length : 0 };
      } catch { return { name: restaurant.name, revenue: 0, orders: 0, averageOrderValue: 0 }; }
    }));

    if (format === 'csv') {
      let csv = 'Restaurant,Revenue,Orders,Average Order Value\n';
      performance.forEach(r => { csv += `${r.name},${r.revenue},${r.orders},${r.averageOrderValue}\n`; });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=restaurant-report.csv');
      return res.send(csv);
    }
    res.json({ restaurantPerformance: performance });
  } catch (error) {
    console.error('Export report error:', error);
    res.status(500).json({ error: 'Failed to export report' });
  }
};

const getSalesData = async (req, res) => {
  try {
    const restaurantSlug = req.user.restaurantSlug;
    const OrderModel = TenantModelFactory.getOrderModel(restaurantSlug);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const sales = await OrderModel.find({
      createdAt: { $gte: thirtyDaysAgo },
      status: { $in: ['DELIVERED', 'PAID'] }
    });
    
    res.json({ sales });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const setExpectedRevenue = async (req, res) => {
  try {
    const { month, year, expectedAmount, notes } = req.body;
    const restaurantSlug = req.user.restaurantSlug;
    const ExpectedRevenueModel = TenantModelFactory.getModel(restaurantSlug, 'ExpectedRevenue', ExpectedRevenue);
    
    let expectedRevenue = await ExpectedRevenueModel.findOne({ month, year });
    if (expectedRevenue) {
      expectedRevenue.expectedAmount = expectedAmount;
      if (notes) expectedRevenue.notes = notes;
      await expectedRevenue.save();
    } else {
      expectedRevenue = new ExpectedRevenueModel({ month, year, expectedAmount, notes });
      await expectedRevenue.save();
    }
    res.json({ message: 'Expected revenue set successfully', expectedRevenue });
  } catch (error) {
    res.status(500).json({ error: 'Failed to set expected revenue' });
  }
};

const getExpectedRevenue = async (req, res) => {
  try {
    const { month, year } = req.query;
    const restaurantSlug = req.user.restaurantSlug;
    const ExpectedRevenueModel = TenantModelFactory.getModel(restaurantSlug, 'ExpectedRevenue', ExpectedRevenue);
    const OrderModel = TenantModelFactory.getOrderModel(restaurantSlug);
    
    const currentMonth = month ? parseInt(month) : new Date().getMonth() + 1;
    const currentYear = year ? parseInt(year) : new Date().getFullYear();
    const startDate = new Date(currentYear, currentMonth - 1, 1);
    const endDate = new Date(currentYear, currentMonth, 0, 23, 59, 59);
    
    const [expectedRevenue, orders] = await Promise.all([
      ExpectedRevenueModel.findOne({ month: currentMonth, year: currentYear }),
      OrderModel.find({ createdAt: { $gte: startDate, $lte: endDate }, status: { $in: ['COMPLETE', 'PAID', 'SERVED', 'READY'] } }).select('totalAmount').lean()
    ]);
    
    const actualAmount = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    if (expectedRevenue) {
      expectedRevenue.actualAmount = actualAmount;
      await expectedRevenue.save();
    }
    
    res.json({
      month: currentMonth, year: currentYear,
      expectedAmount: expectedRevenue?.expectedAmount || 0,
      actualAmount,
      difference: actualAmount - (expectedRevenue?.expectedAmount || 0),
      percentage: expectedRevenue?.expectedAmount ? ((actualAmount / expectedRevenue.expectedAmount) * 100).toFixed(2) : 0,
      notes: expectedRevenue?.notes || ''
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get expected revenue' });
  }
};

const getRevenueComparison = async (req, res) => {
  try {
    const restaurantSlug = req.user.restaurantSlug;
    const ExpectedRevenueModel = TenantModelFactory.getModel(restaurantSlug, 'ExpectedRevenue', ExpectedRevenue);
    const OrderModel = TenantModelFactory.getOrderModel(restaurantSlug);
    
    const currentYear = new Date().getFullYear();
    const expectedRevenues = await ExpectedRevenueModel.find({ year: currentYear }).sort({ month: 1 }).lean();
    
    // Parallel queries for all months
    const comparison = await Promise.all(expectedRevenues.map(async (expected) => {
      const startDate = new Date(expected.year, expected.month - 1, 1);
      const endDate = new Date(expected.year, expected.month, 0, 23, 59, 59);
      const orders = await OrderModel.find({
        createdAt: { $gte: startDate, $lte: endDate },
        status: { $in: ['COMPLETE', 'PAID', 'SERVED', 'READY'] }
      }).select('totalAmount').lean();
      const actualAmount = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
      return {
        month: expected.month, year: expected.year,
        expectedAmount: expected.expectedAmount, actualAmount,
        difference: actualAmount - expected.expectedAmount,
        percentage: ((actualAmount / expected.expectedAmount) * 100).toFixed(2)
      };
    }));
    
    res.json({ comparison });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get revenue comparison' });
  }
};

module.exports = {
  getAdvancedAnalytics,
  exportReport,
  getSalesData,
  setExpectedRevenue,
  getExpectedRevenue,
  getRevenueComparison
};