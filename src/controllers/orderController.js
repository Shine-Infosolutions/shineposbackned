const { validationResult } = require('express-validator');
const TenantModelFactory = require('../models/TenantModelFactory');
const Restaurant = require('../models/Restaurant');
const Settings = require('../models/Settings');

const createOrder = async (req, res) => {
  try {
    console.log('Order request:', req.body);
    console.log('Restaurant slug from params:', req.params.restaurantSlug);
    console.log('Original URL:', req.originalUrl);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    let restaurantSlug;
    
    // Check if slug is in URL params (public route: /api/:restaurantSlug/orders)
    if (req.params.restaurantSlug) {
      restaurantSlug = req.params.restaurantSlug;
    } else if (req.user && req.user.restaurantSlug) {
      // For authenticated routes, get slug from user's restaurant
      restaurantSlug = req.user.restaurantSlug;
    } else {
      return res.status(400).json({ error: 'Restaurant slug not found' });
    }
    
    console.log('Final restaurant slug:', restaurantSlug);

    const { items, customerName, customerPhone } = req.body;

    if (!restaurantSlug) {
      return res.status(400).json({ error: 'Restaurant slug is required' });
    }

    // Check restaurant status
    const restaurant = await Restaurant.findOne({ slug: restaurantSlug });
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    if (!restaurant.isActive) {
      return res.status(403).json({ error: 'Restaurant is temporarily not accepting orders' });
    }

    // Get dynamic order limit from settings
    const orderLimitSetting = await Settings.findOne({ 
      key: `PLAN_${restaurant.subscriptionPlan.toUpperCase()}_ORDERS` 
    });
    const orderLimit = orderLimitSetting?.value || (restaurant.subscriptionPlan === 'trial' ? 5 : 500);

    // Check order limits
    const OrderModel = req.tenantModels?.Order || TenantModelFactory.getOrderModel(restaurantSlug);
    const currentOrderCount = await OrderModel.countDocuments();
    
    if (currentOrderCount >= orderLimit) {
      return res.status(403).json({ 
        error: `${restaurant.subscriptionPlan.charAt(0).toUpperCase() + restaurant.subscriptionPlan.slice(1)} accounts are limited to ${orderLimit} orders. Please upgrade to continue.`
      });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Items are required' });
    }

    try {
      const MenuModel = req.tenantModels?.Menu || TenantModelFactory.getMenuModel(restaurantSlug);

      // Validate menu items and calculate total
      let totalAmount = 0;
      const orderItems = [];

      for (const item of items) {
        if (!item.menuId || !item.quantity) {
          return res.status(400).json({ error: 'Invalid item format' });
        }

        const menuItem = await MenuModel.findById(item.menuId);
        if (!menuItem) {
          return res.status(400).json({ error: `Menu item ${item.menuId} not found` });
        }
        
        if (!menuItem.isAvailable) {
          return res.status(400).json({ error: `Menu item ${menuItem.name} is not available` });
        }
        
        const itemTotal = menuItem.price * item.quantity;
        totalAmount += itemTotal;
        
        orderItems.push({
          menuId: menuItem._id,
          name: menuItem.name,
          price: menuItem.price,
          quantity: item.quantity
        });
      }

      // Generate order number
      const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

      const order = new OrderModel({
        orderNumber,
        items: orderItems,
        totalAmount,
        customerName,
        customerPhone: customerPhone || ''
      });

      await order.save();

      // No need to update billing usage for orders

      res.status(201).json({
        message: 'Order created successfully',
        order: {
          id: order._id,
          orderNumber: order.orderNumber,
          items: order.items,
          totalAmount: order.totalAmount,
          status: order.status,
          customerName: order.customerName,
          createdAt: order.createdAt
        }
      });
    } catch (dbError) {
      console.error('Database error:', dbError);
      return res.status(500).json({ error: 'Database connection failed. Restaurant may not exist.' });
    }
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Failed to create order', details: error.message });
  }
};

const getOrders = async (req, res) => {
  try {
    const OrderModel = req.tenantModels?.Order || TenantModelFactory.getOrderModel(req.user.restaurantSlug);
    const orders = await OrderModel.find().sort({ createdAt: -1 });
    res.json({ orders });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const OrderModel = req.tenantModels?.Order || TenantModelFactory.getOrderModel(req.user.restaurantSlug);
    
    const order = await OrderModel.findByIdAndUpdate(
      id, 
      { status }, 
      { new: true }
    );
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ message: 'Order status updated successfully', order });
  } catch (error) {
    console.error('Update order error:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
};

module.exports = {
  createOrder,
  getOrders,
  updateOrderStatus
};