const TenantModelFactory = require('../models/TenantModelFactory');
const kotPrinter = require('../utils/kotPrinter');

const getKitchenOrders = async (req, res) => {
  try {
    const restaurantSlug = req.user.restaurantSlug;
    console.log('Fetching kitchen orders for restaurant:', restaurantSlug);
    
    const OrderModel = TenantModelFactory.getOrderModel(restaurantSlug);
    const KOTModel = TenantModelFactory.getKOTModel(restaurantSlug);
    
    // Get orders and their associated KOTs
    const orders = await OrderModel.find({
      status: { $in: ['PENDING', 'PREPARING'] }
    }).sort({ createdAt: 1 });
    
    const kots = await KOTModel.find()
      .sort({ priority: -1, createdAt: -1 });
    
    console.log('Found orders:', orders.length, 'Found KOTs:', kots.length);
    console.log('KOT statuses:', kots.map(k => ({ id: k._id, status: k.status })));
    
    res.json({ orders, kots });
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
    const KOTModel = TenantModelFactory.getKOTModel(restaurantSlug);
    
    const order = await OrderModel.findById(id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    order.status = status;
    if (status === 'PREPARING') order.prepStartTime = new Date();
    if (status === 'READY') order.prepEndTime = new Date();
    await order.save();

    if (status === 'PREPARING') {
      try {
        const existingKOT = await KOTModel.findOne({ orderId: id });
        if (!existingKOT) {
          const kot = new KOTModel({
            orderId: id,
            orderNumber: order.orderNumber,
            items: order.items,
            customerName: order.customerName,
            printedAt: new Date()
          });
          await kot.save();
        }
      } catch (kotError) {
        console.error('Auto KOT creation error:', kotError);
      }
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
    const KOTModel = TenantModelFactory.getKOTModel(restaurantSlug);
    
    const order = await OrderModel.findById(id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    order.priority = priority || 'normal';
    await order.save();

    await KOTModel.updateMany(
      { orderId: id },
      { priority: priority?.toUpperCase() || 'NORMAL' }
    );

    res.json({ message: 'Order priority updated successfully', order });
  } catch (error) {
    console.error('Set priority error:', error);
    res.status(500).json({ error: 'Failed to set order priority' });
  }
};

// Print KOT for order
const printOrderKOT = async (req, res) => {
  try {
    const { id } = req.params;
    const restaurantSlug = req.user.restaurantSlug;
    const OrderModel = TenantModelFactory.getOrderModel(restaurantSlug);
    const KOTModel = TenantModelFactory.getKOTModel(restaurantSlug);
    
    const order = await OrderModel.findById(id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Find or create KOT
    let kot = await KOTModel.findOne({ orderId: id });
    if (!kot) {
      kot = new KOTModel({
        orderId: id,
        orderNumber: order.orderNumber,
        items: order.items,
        customerName: order.customerName
      });
      await kot.save();
    }

    // Print KOT
    const printData = {
      restaurantName: req.user.restaurantName || 'Restaurant',
      orderNumber: order.orderNumber,
      kotNumber: kot.kotNumber,
      items: order.items,
      customerName: order.customerName,
      createdAt: order.createdAt
    };

    const printResult = await kotPrinter.printKOT(printData);
    
    if (printResult.success) {
      kot.printedAt = new Date();
      await kot.save();
      res.json({ message: 'KOT printed successfully', printResult });
    } else {
      res.status(500).json({ error: 'Failed to print KOT', details: printResult.error });
    }
  } catch (error) {
    console.error('Print order KOT error:', error);
    res.status(500).json({ error: 'Failed to print order KOT' });
  }
};

// Update KOT status
const updateKOTStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const restaurantSlug = req.user.restaurantSlug;
    const KOTModel = TenantModelFactory.getKOTModel(restaurantSlug);
    const OrderModel = TenantModelFactory.getOrderModel(restaurantSlug);
    
    const kot = await KOTModel.findById(id);
    if (!kot) {
      return res.status(404).json({ error: 'KOT not found' });
    }
    
    kot.status = status;
    if (status === 'PREPARING') kot.startedAt = new Date();
    if (status === 'COMPLETE' || status === 'SERVED') kot.completedAt = new Date();
    await kot.save();

    if (kot.orderId) {
      const order = await OrderModel.findById(kot.orderId);
      if (order) {
        order.status = status;
        await order.save();
      }
    }

    res.json({ message: 'KOT status updated successfully', kot });
  } catch (error) {
    console.error('Update KOT status error:', error);
    res.status(500).json({ error: 'Failed to update KOT status' });
  }
};

module.exports = {
  getKitchenOrders,
  updateOrderStatus,
  setPriority,
  printOrderKOT,
  updateKOTStatus
};