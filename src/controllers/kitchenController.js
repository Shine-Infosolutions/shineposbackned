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
    
    const kots = await KOTModel.find({
      status: { $in: ['PENDING', 'IN_PROGRESS'] }
    }).sort({ priority: -1, createdAt: 1 });
    
    console.log('Found orders:', orders.length, 'Found KOTs:', kots.length);
    
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

    // Auto-create KOT when order status changes to PREPARING
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
    
    const order = await OrderModel.findByIdAndUpdate(
      id,
      { priority: priority || 'normal' },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Update associated KOT priority
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
      await KOTModel.findByIdAndUpdate(kot._id, { printedAt: new Date() });
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
    
    const kot = await KOTModel.findByIdAndUpdate(
      id,
      { 
        status,
        ...(status === 'IN_PROGRESS' && { startedAt: new Date() }),
        ...(status === 'COMPLETED' && { completedAt: new Date() })
      },
      { new: true }
    );

    if (!kot) {
      return res.status(404).json({ error: 'KOT not found' });
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