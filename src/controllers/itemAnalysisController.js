const TenantModelFactory = require('../models/TenantModelFactory');
const Restaurant = require('../models/Restaurant');

exports.getItemAnalysis = async (req, res) => {
  try {
    const { startDate, endDate, dateRange } = req.query;
    const restaurantSlug = req.user.restaurantSlug;
    
    const Order = TenantModelFactory.getOrderModel(restaurantSlug);
    const Menu = TenantModelFactory.getMenuItemModel(restaurantSlug);
    
    let dateFilter = {};
    if (dateRange && dateRange !== 'all') {
      const now = new Date();
      const filterDate = new Date();
      switch(dateRange) {
        case 'today': filterDate.setHours(0, 0, 0, 0); dateFilter = { createdAt: { $gte: filterDate } }; break;
        case 'week': filterDate.setDate(now.getDate() - 7); dateFilter = { createdAt: { $gte: filterDate } }; break;
        case 'month': filterDate.setMonth(now.getMonth() - 1); dateFilter = { createdAt: { $gte: filterDate } }; break;
        case 'custom':
          if (startDate && endDate) dateFilter = { createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) } };
          break;
      }
    }
    
    // Use aggregation pipeline instead of loading all orders into memory
    const [itemAggregation, menuItems] = await Promise.all([
      Order.aggregate([
        { $match: dateFilter },
        { $project: { items: 1, extraItems: 1 } },
        { $unwind: { path: '$items', preserveNullAndEmptyArrays: false } },
        { $group: {
          _id: '$items.name',
          quantity: { $sum: '$items.quantity' },
          revenue: { $sum: { $ifNull: ['$items.itemTotal', { $multiply: ['$items.quantity', { $ifNull: ['$items.price', '$items.basePrice'] }] }] } }
        }}
      ]),
      Menu.find().select('itemName categoryID marginCostPercentage').populate('categoryID', 'name').lean()
    ]);
    
    const menuMap = {};
    menuItems.forEach(item => {
      menuMap[item.itemName] = {
        category: item.categoryID?.name || 'Uncategorized',
        marginCost: (item.marginCostPercentage || 40) / 100
      };
    });
    
    const items = itemAggregation.map(item => {
      const menuInfo = menuMap[item._id] || { category: 'Uncategorized', marginCost: 0.4 };
      const cost = item.revenue * menuInfo.marginCost;
      return {
        name: item._id,
        category: menuInfo.category,
        marginCostPercentage: Math.round(menuInfo.marginCost * 100),
        quantity: item.quantity,
        revenue: item.revenue,
        cost,
        profit: item.revenue - cost,
        margin: Math.round(menuInfo.marginCost * 100)
      };
    });
    
    res.json({
      success: true,
      items,
      totalItems: items.length,
      totalRevenue: items.reduce((sum, item) => sum + item.revenue, 0),
      totalProfit: items.reduce((sum, item) => sum + item.profit, 0)
    });
  } catch (error) {
    console.error('Item analysis error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch item analysis', error: error.message });
  }
};
