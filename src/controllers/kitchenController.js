const TenantModelFactory = require('../models/TenantModelFactory');

const getKitchenOrders = async (req, res) => {
  try {
    const restaurantSlug = req.user.restaurantSlug;
    const OrderModel = TenantModelFactory.getOrderModel(restaurantSlug);
    
    const orders = await OrderModel.find({
      status: { $in: ['PENDING', 'PREPARING'] }
    }).sort({ createdAt: 1 });
    
    res.json({ orders });
  } catch (error) {
    console.error('Get kitchen orders error:', error);
    res.status(500).json({ error: 'Failed to fetch kitchen orders' });
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const restaurantSlug = req.user.restaurantSlug;
    const OrderModel = TenantModelFactory.getOrderModel(restaurantSlug);
    
    const order = await OrderModel.findByIdAndUpdate(
      id,
      { 
        status,
        ...(status === 'PREPARING' && { prepStartTime: new Date() }),
        ...(status === 'READY' && { prepEndTime: new Date() })
      },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ message: 'Order status updated successfully', order });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
};

const setPriority = async (req, res) => {
  try {
    const { id } = req.params;
    const { priority } = req.body;
    const restaurantSlug = req.user.restaurantSlug;
    const OrderModel = TenantModelFactory.getOrderModel(restaurantSlug);
    
    const order = await OrderModel.findByIdAndUpdate(
      id,
      { priority: priority || 'normal' },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ message: 'Order priority updated successfully', order });
  } catch (error) {
    console.error('Set priority error:', error);
    res.status(500).json({ error: 'Failed to set order priority' });
  }
};

module.exports = {
  getKitchenOrders,
  updateOrderStatus,
  setPriority
};