const TenantModelFactory = require('../models/TenantModelFactory');

const getDashboardStats = async (req, res) => {
  try {
    const restaurantSlug = req.user?.restaurantSlug;
    if (!restaurantSlug) {
      return res.status(400).json({ error: 'Restaurant slug not found' });
    }

    const { filter = 'today', startDate: customStartDate, endDate: customEndDate } = req.query;

    const OrderModel = TenantModelFactory.getOrderModel(restaurantSlug);
    const MenuModel = TenantModelFactory.getMenuItemModel(restaurantSlug);
    const StaffModel = TenantModelFactory.getStaffModel(restaurantSlug);
    const CategoryModel = TenantModelFactory.getCategoryModel(restaurantSlug);

    // Calculate date range based on filter
    let startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    
    if (filter === 'custom' && customStartDate && customEndDate) {
      startDate = new Date(customStartDate);
      startDate.setHours(0, 0, 0, 0);
    } else if (filter === 'weekly') {
      startDate.setDate(startDate.getDate() - 7);
    } else if (filter === 'monthly') {
      startDate.setMonth(startDate.getMonth() - 1);
    }

    let endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    
    if (filter === 'custom' && customEndDate) {
      endDate = new Date(customEndDate);
      endDate.setHours(23, 59, 59, 999);
    }

    // Fetch data — use countDocuments for live status counts (no full scan)
    const [filteredOrders, menuItemCount, staff, categories,
      pendingOrders, preparingOrders, completedOrders, paidOrders,
      recentOrders] = await Promise.all([
      OrderModel.find({ createdAt: { $gte: startDate, $lte: endDate } }).lean(),
      MenuModel.countDocuments(),
      StaffModel.countDocuments({ isActive: true }),
      CategoryModel.find().select('_id name').lean(),
      OrderModel.countDocuments({ status: { $in: ['PENDING', 'ORDER_ACCEPTED'] } }),
      OrderModel.countDocuments({ status: { $in: ['PREPARING', 'READY', 'SERVED'] } }),
      OrderModel.countDocuments({ status: 'DELIVERED' }),
      OrderModel.countDocuments({ status: 'PAID' }),
      OrderModel.find({ status: { $ne: 'PAID' } })
        .sort({ createdAt: -1 }).limit(10)
        .select('orderNumber customerName items totalAmount status createdAt').lean()
    ]);

    // Calculate stats
    const revenue = filteredOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
    const avgOrderValue = filteredOrders.length > 0 ? revenue / filteredOrders.length : 0;

    // Calculate payment statistics
    const ordersWithPayment = filteredOrders.filter(o => o.paymentDetails?.method);
    const cashPayments = ordersWithPayment.filter(o => o.paymentDetails.method.toLowerCase() === 'cash').reduce((sum, o) => sum + o.totalAmount, 0);
    const cardPayments = ordersWithPayment.filter(o => o.paymentDetails.method.toLowerCase() === 'card').reduce((sum, o) => sum + o.totalAmount, 0);
    const upiPayments = ordersWithPayment.filter(o => o.paymentDetails.method.toLowerCase() === 'upi').reduce((sum, o) => sum + o.totalAmount, 0);
    const totalPayments = cashPayments + cardPayments + upiPayments;
    const cashPercentage = totalPayments > 0 ? Math.round((cashPayments / totalPayments) * 100) : 0;
    const cardPercentage = totalPayments > 0 ? Math.round((cardPayments / totalPayments) * 100) : 0;
    const upiPercentage = totalPayments > 0 ? Math.round((upiPayments / totalPayments) * 100) : 0;

    // Hourly revenue breakdown
    const hourlyRevenue = Array(24).fill(0);
    filteredOrders.forEach(order => {
      const hour = new Date(order.createdAt).getHours();
      hourlyRevenue[hour] += order.totalAmount || 0;
    });

    // Category breakdown — use category map from already-fetched categories
    const categoryMap = {};
    categories.forEach(cat => { categoryMap[cat._id.toString()] = cat.name; });

    const categoryBreakdown = {};
    filteredOrders.forEach(order => {
      order.items?.forEach(item => {
        const catName = (item.categoryId && categoryMap[item.categoryId.toString()]) || 'Other';
        categoryBreakdown[catName] = (categoryBreakdown[catName] || 0) + (item.totalPrice || (item.basePrice || 0) * (item.quantity || 1));
      });
    });

    const categoryData = Object.entries(categoryBreakdown).map(([category, amount]) => ({
      category,
      amount,
      percentage: revenue > 0 ? Math.round((amount / revenue) * 100) : 0
    })).sort((a, b) => b.amount - a.amount);

    res.json({
      success: true,
      filter,
      stats: {
        orders: filteredOrders.length,
        revenue,
        avgOrderValue,
        totalMenuItems: menuItemCount,
        activeStaff: staff,
        pendingOrders,
        preparingOrders,
        completedOrders,
        paidOrders,

        cashPayments,
        cardPayments,
        upiPayments,
        cashPercentage,
        cardPercentage,
        upiPercentage
      },
      recentOrders,
      analytics: {
        hourlyRevenue,
        categoryBreakdown: categoryData
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to get dashboard stats' });
  }
};

const getPeakHours = async (req, res) => {
  try {
    const restaurantSlug = req.user?.restaurantSlug;
    if (!restaurantSlug) {
      return res.status(400).json({ error: 'Restaurant slug not found' });
    }

    const OrderModel = TenantModelFactory.getOrderModel(restaurantSlug);
    
    // Get orders from last 30 days for better analysis
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const orders = await OrderModel.find({ 
      createdAt: { $gte: thirtyDaysAgo },
      status: { $in: ['COMPLETE', 'SERVED'] }
    }).lean();

    // Hourly analysis
    const hourlyData = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      orders: 0,
      revenue: 0,
      totalWaitTime: 0,
      count: 0
    }));

    // Weekly analysis
    const weeklyData = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => ({
      day,
      dayIndex: index,
      orders: 0,
      revenue: 0,
      totalWaitTime: 0,
      count: 0
    }));

    orders.forEach(order => {
      const orderDate = new Date(order.createdAt);
      const hour = orderDate.getHours();
      const dayIndex = (orderDate.getDay() + 6) % 7; // Convert Sunday=0 to Monday=0
      
      // Hourly data
      hourlyData[hour].orders++;
      hourlyData[hour].revenue += order.totalAmount || 0;
      
      // Weekly data
      weeklyData[dayIndex].orders++;
      weeklyData[dayIndex].revenue += order.totalAmount || 0;
      
      // Calculate wait time using updatedAt (when order was completed)
      const waitTime = Math.round((new Date(order.updatedAt) - new Date(order.createdAt)) / 60000);
      if (waitTime > 0 && waitTime < 300) { // Only count reasonable wait times (< 5 hours)
        hourlyData[hour].totalWaitTime += waitTime;
        hourlyData[hour].count++;
        weeklyData[dayIndex].totalWaitTime += waitTime;
        weeklyData[dayIndex].count++;
      }
    });

    // Calculate average wait times
    hourlyData.forEach(h => {
      h.avgWaitTime = h.count > 0 ? Math.round(h.totalWaitTime / h.count) : 0;
      delete h.totalWaitTime;
      delete h.count;
    });

    weeklyData.forEach(d => {
      d.avgWaitTime = d.count > 0 ? Math.round(d.totalWaitTime / d.count) : 0;
      delete d.totalWaitTime;
      delete d.count;
      delete d.dayIndex;
    });

    // Find peak hour and day
    const peakHour = hourlyData.reduce((max, h) => h.orders > max.orders ? h : max, hourlyData[0]);
    const peakDay = weeklyData.reduce((max, d) => d.orders > max.orders ? d : max, weeklyData[0]);

    res.json({
      success: true,
      hourly: hourlyData,
      weekly: weeklyData,
      peakHour,
      peakDay
    });
  } catch (error) {
    console.error('Peak hours error:', error);
    res.status(500).json({ error: 'Failed to get peak hours data' });
  }
};

module.exports = {
  getDashboardStats,
  getPeakHours
};
