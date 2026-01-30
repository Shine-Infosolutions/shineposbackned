const TenantModelFactory = require('../models/TenantModelFactory');

const getDashboardStats = async (req, res) => {
  try {
    const restaurantSlug = req.user?.restaurantSlug;
    if (!restaurantSlug) {
      return res.status(400).json({ error: 'Restaurant slug not found' });
    }

    const { filter = 'today' } = req.query;

    const OrderModel = TenantModelFactory.getOrderModel(restaurantSlug);
    const MenuModel = TenantModelFactory.getMenuItemModel(restaurantSlug);
    const StaffModel = TenantModelFactory.getStaffModel(restaurantSlug);

    // Calculate date range based on filter
    let startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    
    if (filter === 'weekly') {
      startDate.setDate(startDate.getDate() - 7);
    } else if (filter === 'monthly') {
      startDate.setMonth(startDate.getMonth() - 1);
    }

    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    // Fetch data
    const [allOrders, filteredOrders, menuItems, staff] = await Promise.all([
      OrderModel.find().lean(),
      OrderModel.find({ createdAt: { $gte: startDate, $lte: endDate } }).lean(),
      MenuModel.countDocuments(),
      StaffModel.countDocuments({ isActive: true })
    ]);

    // Calculate stats
    const revenue = filteredOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
    const avgOrderValue = filteredOrders.length > 0 ? revenue / filteredOrders.length : 0;
    const pendingOrders = allOrders.filter(o => o.status === 'PENDING' || o.status === 'ORDER_ACCEPTED').length;
    const preparingOrders = allOrders.filter(o => o.status === 'PREPARING' || o.status === 'READY' || o.status === 'SERVED').length;
    const completedOrders = allOrders.filter(o => o.status === 'DELIVERED').length;
    const paidOrders = allOrders.filter(o => o.status === 'PAID').length;

    // Calculate payment statistics
    const ordersWithPayment = filteredOrders.filter(o => o.paymentDetails && o.paymentDetails.method);
    const cashPayments = ordersWithPayment.filter(o => o.paymentDetails.method.toLowerCase() === 'cash').reduce((sum, o) => sum + o.totalAmount, 0);
    const cardPayments = ordersWithPayment.filter(o => o.paymentDetails.method.toLowerCase() === 'card').reduce((sum, o) => sum + o.totalAmount, 0);
    const upiPayments = ordersWithPayment.filter(o => o.paymentDetails.method.toLowerCase() === 'upi').reduce((sum, o) => sum + o.totalAmount, 0);
    const totalPayments = cashPayments + cardPayments + upiPayments;
    const cashPercentage = totalPayments > 0 ? Math.round((cashPayments / totalPayments) * 100) : 0;
    const cardPercentage = totalPayments > 0 ? Math.round((cardPayments / totalPayments) * 100) : 0;
    const upiPercentage = totalPayments > 0 ? Math.round((upiPayments / totalPayments) * 100) : 0;

    // Recent orders (last 10, excluding PAID orders)
    const recentOrders = allOrders
      .filter(order => order.status !== 'PAID')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10)
      .map(order => ({
        _id: order._id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        items: order.items || [],
        totalAmount: order.totalAmount,
        status: order.status,
        createdAt: order.createdAt
      }));

    res.json({
      success: true,
      filter,
      stats: {
        orders: filteredOrders.length,
        revenue,
        avgOrderValue,
        totalMenuItems: menuItems,
        activeStaff: staff,
        pendingOrders,
        preparingOrders,
        completedOrders,
        paidOrders,
        customerSatisfaction: 4.8,
        cashPayments,
        cardPayments,
        upiPayments,
        cashPercentage,
        cardPercentage,
        upiPercentage
      },
      recentOrders
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to get dashboard stats' });
  }
};

module.exports = {
  getDashboardStats
};
