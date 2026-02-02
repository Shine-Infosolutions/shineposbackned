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

    // Fetch data
    const [allOrders, filteredOrders, menuItems, staff, categories] = await Promise.all([
      OrderModel.find().lean(),
      OrderModel.find({ createdAt: { $gte: startDate, $lte: endDate } }).lean(),
      MenuModel.find().lean(),
      StaffModel.countDocuments({ isActive: true }),
      CategoryModel.find().lean()
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

    // Hourly revenue breakdown
    const hourlyRevenue = Array(24).fill(0);
    filteredOrders.forEach(order => {
      const hour = new Date(order.createdAt).getHours();
      hourlyRevenue[hour] += order.totalAmount || 0;
    });

    // Category breakdown
    console.log('=== CATEGORY BREAKDOWN DEBUG ===');
    console.log('Categories:', categories);
    console.log('Menu Items sample:', menuItems.slice(0, 2));
    console.log('Filtered Orders sample:', filteredOrders.slice(0, 1));
    
    const categoryMap = {};
    categories.forEach(cat => {
      categoryMap[cat._id.toString()] = cat.name;
    });
    console.log('Category Map:', categoryMap);

    const categoryBreakdown = {};
    filteredOrders.forEach(order => {
      order.items?.forEach(item => {
        console.log('Processing item:', { menuId: item.menuId, name: item.name, totalPrice: item.totalPrice });
        
        // Try to find menu item by ID or name
        let menuItem = menuItems.find(m => m._id.toString() === item.menuId?.toString());
        
        // If not found by ID, try by name
        if (!menuItem && item.name) {
          menuItem = menuItems.find(m => m.name === item.name);
        }
        
        console.log('Found menu item:', menuItem);
        
        if (menuItem && menuItem.category) {
          const catName = categoryMap[menuItem.category.toString()] || 'Other';
          if (!categoryBreakdown[catName]) {
            categoryBreakdown[catName] = 0;
          }
          categoryBreakdown[catName] += item.totalPrice || item.basePrice * item.quantity || 0;
          console.log(`Added ${item.totalPrice || 0} to ${catName}`);
        } else {
          // If no category found, add to "Other"
          if (!categoryBreakdown['Other']) {
            categoryBreakdown['Other'] = 0;
          }
          categoryBreakdown['Other'] += item.totalPrice || item.basePrice * item.quantity || 0;
          console.log('Added to Other category');
        }
      });
    });
    
    console.log('Final Category Breakdown:', categoryBreakdown);

    const categoryData = Object.entries(categoryBreakdown).map(([category, amount]) => ({
      category,
      amount,
      percentage: revenue > 0 ? Math.round((amount / revenue) * 100) : 0
    })).sort((a, b) => b.amount - a.amount);

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
        totalMenuItems: menuItems.length,
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

module.exports = {
  getDashboardStats
};
