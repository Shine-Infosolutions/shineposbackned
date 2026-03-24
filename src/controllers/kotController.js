const TenantModelFactory = require('../models/TenantModelFactory');
const kotPrinter = require('../utils/kotPrinter');

// Create KOT from order
const createKOT = async (req, res) => {
  try {
    const { orderId, items, tableNumber, notes, priority } = req.body;
    const restaurantSlug = req.user.restaurantSlug;
    
    const KOTModel = TenantModelFactory.getKOTModel(restaurantSlug);
    const OrderModel = TenantModelFactory.getOrderModel(restaurantSlug);
    
    // Get order details
    const order = await OrderModel.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Create KOT
    const kot = new KOTModel({
      orderId,
      orderNumber: order.orderNumber,
      items: items || order.items,
      tableNumber,
      customerName: order.customerName,
      priority: priority || 'NORMAL',
      notes,
      printedAt: new Date()
    });
    
    await kot.save();
    
    res.status(201).json({
      message: 'KOT created successfully',
      kot
    });
  } catch (error) {
    console.error('Create KOT error:', error);
    res.status(500).json({ error: 'Failed to create KOT' });
  }
};

// Get all KOTs — with pagination
const getKOTs = async (req, res) => {
  try {
    const { status, priority, page = 1, limit = 50 } = req.query;
    const restaurantSlug = req.user.restaurantSlug;
    const KOTModel = TenantModelFactory.getKOTModel(restaurantSlug);
    
    const filter = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [kots, total] = await Promise.all([
      KOTModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      KOTModel.countDocuments(filter)
    ]);
    
    res.json({ kots, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (error) {
    console.error('Get KOTs error:', error);
    res.status(500).json({ error: 'Failed to fetch KOTs' });
  }
};

// Get KOT by ID
const getKOTById = async (req, res) => {
  try {
    const { id } = req.params;
    const restaurantSlug = req.user.restaurantSlug;
    const KOTModel = TenantModelFactory.getKOTModel(restaurantSlug);
    
    const kot = await KOTModel.findById(id).populate('orderId');
    if (!kot) {
      return res.status(404).json({ error: 'KOT not found' });
    }
    
    res.json({ kot });
  } catch (error) {
    console.error('Get KOT by ID error:', error);
    res.status(500).json({ error: 'Failed to fetch KOT' });
  }
};
// Update KOT status — use findByIdAndUpdate to avoid extra fetch+save
const updateKOTStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const restaurantSlug = req.user.restaurantSlug;
    const KOTModel = TenantModelFactory.getKOTModel(restaurantSlug);
    
    const allowedStatuses = ['PENDING', 'PREPARING', 'READY', 'SERVED', 'CANCELLED'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid KOT status' });
    }
    
    const kot = await KOTModel.findByIdAndUpdate(id, { status }, { new: true });
    if (!kot) return res.status(404).json({ error: 'KOT not found' });

    // Sync order status only for terminal/meaningful transitions
    const orderStatusMap = { PREPARING: 'PREPARING', READY: 'READY', SERVED: 'SERVED', CANCELLED: 'CANCELLED' };
    if (orderStatusMap[status] && kot.orderId) {
      try {
        const OrderModel = TenantModelFactory.getOrderModel(restaurantSlug);
        await OrderModel.findByIdAndUpdate(kot.orderId, { status: orderStatusMap[status] });
      } catch (orderError) {
        console.error('Order status sync error:', orderError);
      }
    }
    
    res.json({ message: 'KOT status updated successfully', kot });
  } catch (error) {
    console.error('Update KOT status error:', error);
    res.status(500).json({ error: 'Failed to update KOT status' });
  }
};

// Update KOT priority
const updateKOTPriority = async (req, res) => {
  try {
    const { id } = req.params;
    const { priority } = req.body;
    const restaurantSlug = req.user.restaurantSlug;
    const KOTModel = TenantModelFactory.getKOTModel(restaurantSlug);
    const OrderModel = TenantModelFactory.getOrderModel(restaurantSlug);
    
    const kot = await KOTModel.findById(id);
    if (!kot) {
      return res.status(404).json({ error: 'KOT not found' });
    }
    
    kot.priority = priority;
    const savedKOT = await kot.save();
    
    // Sync priority with associated order
    if (kot.orderId) {
      const order = await OrderModel.findById(kot.orderId);
      if (order) {
        order.priority = priority;
        await order.save();
      }
    }
    
    res.json({
      message: 'KOT priority updated successfully',
      kot: savedKOT
    });
  } catch (error) {
    console.error('Update KOT priority error:', error);
    res.status(500).json({ error: 'Failed to update KOT priority' });
  }
};

// Print KOT
const printKOT = async (req, res) => {
  try {
    const { id } = req.params;
    const restaurantSlug = req.user.restaurantSlug;
    const KOTModel = TenantModelFactory.getKOTModel(restaurantSlug);
    
    const kot = await KOTModel.findById(id);
    if (!kot) {
      return res.status(404).json({ error: 'KOT not found' });
    }
    
    // Prepare data for printing
    const printData = {
      restaurantName: req.user.restaurantName || 'Restaurant',
      orderNumber: kot.orderNumber,
      kotNumber: kot.kotNumber,
      items: kot.items,
      tableNumber: kot.tableNumber,
      customerName: kot.customerName,
      priority: kot.priority,
      notes: kot.notes,
      createdAt: kot.createdAt
    };
    
    // Print KOT
    const printResult = await kotPrinter.printKOT(printData);
    
    if (printResult.success) {
      kot.printedAt = new Date();
      await kot.save();
      
      res.json({
        message: 'KOT printed successfully',
        printResult
      });
    } else {
      res.status(500).json({
        error: 'Failed to print KOT',
        details: printResult.error
      });
    }
  } catch (error) {
    console.error('Print KOT error:', error);
    res.status(500).json({ error: 'Failed to print KOT' });
  }
};

// Get kitchen dashboard data
const getKitchenDashboard = async (req, res) => {
  try {
    const restaurantSlug = req.user.restaurantSlug;
    const KOTModel = TenantModelFactory.getKOTModel(restaurantSlug);
    
    const [pendingKOTs, inProgressKOTs, completedToday] = await Promise.all([
      KOTModel.countDocuments({ status: 'PENDING' }),
      KOTModel.countDocuments({ status: 'PREPARING' }),
      KOTModel.countDocuments({
        status: 'SERVED',
        completedAt: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0))
        }
      })
    ]);
    
    const recentKOTs = await KOTModel.find({
      status: { $in: ['PENDING', 'PREPARING'] }
    })
    .sort({ priority: -1, createdAt: 1 })
    .limit(10);
    
    res.json({
      dashboard: {
        pendingKOTs,
        inProgressKOTs,
        completedToday,
        recentKOTs
      }
    });
  } catch (error) {
    console.error('Get kitchen dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch kitchen dashboard data' });
  }
};

// Delete KOT
const deleteKOT = async (req, res) => {
  try {
    const { id } = req.params;
    const restaurantSlug = req.user.restaurantSlug;
    const KOTModel = TenantModelFactory.getKOTModel(restaurantSlug);
    
    const kot = await KOTModel.findByIdAndDelete(id);
    if (!kot) {
      return res.status(404).json({ error: 'KOT not found' });
    }
    
    res.json({ message: 'KOT deleted successfully' });
  } catch (error) {
    console.error('Delete KOT error:', error);
    res.status(500).json({ error: 'Failed to delete KOT' });
  }
};

// Update individual item status in KOT
const updateKOTItemStatus = async (req, res) => {
  try {
    const { id, itemIndex } = req.params;
    const { status, isExtraItem } = req.body;
    const restaurantSlug = req.user.restaurantSlug;
    const KOTModel = TenantModelFactory.getKOTModel(restaurantSlug);
    const OrderModel = TenantModelFactory.getOrderModel(restaurantSlug);
    
    const kot = await KOTModel.findById(id);
    if (!kot) {
      return res.status(404).json({ error: 'KOT not found' });
    }
    
    const itemArray = isExtraItem ? kot.extraItems : kot.items;
    if (!itemArray || !itemArray[itemIndex]) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    itemArray[itemIndex].status = status;
    if (status === 'PREPARING') {
      if (!itemArray[itemIndex].startedAt) {
        itemArray[itemIndex].startedAt = new Date();
      }
    }
    if (status === 'READY') {
      if (!itemArray[itemIndex].startedAt) {
        itemArray[itemIndex].startedAt = new Date(Date.now() - 60000);
      }
      itemArray[itemIndex].readyAt = new Date();
      const seconds = Math.round((itemArray[itemIndex].readyAt - itemArray[itemIndex].startedAt) / 1000);
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      itemArray[itemIndex].actualPrepTime = `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    if (isExtraItem) {
      kot.markModified('extraItems');
    } else {
      kot.markModified('items');
    }
    await kot.save();

    // Sync to order
    try {
      const order = await OrderModel.findById(kot.orderId);
      if (order) {
        const orderItemArray = isExtraItem ? order.extraItems : order.items;
        if (orderItemArray && orderItemArray[itemIndex]) {
          orderItemArray[itemIndex].status = status;
          if (itemArray[itemIndex].startedAt) {
            orderItemArray[itemIndex].startedAt = itemArray[itemIndex].startedAt;
          }
          if (itemArray[itemIndex].readyAt) {
            orderItemArray[itemIndex].readyAt = itemArray[itemIndex].readyAt;
            orderItemArray[itemIndex].actualPrepTime = itemArray[itemIndex].actualPrepTime;
          }
          if (isExtraItem) {
            order.markModified('extraItems');
          } else {
            order.markModified('items');
          }
          await order.save();
        }
      }
    } catch (orderError) {
      // Silent fail for order sync
    }

    res.json({ message: 'Item status updated successfully', kot });
  } catch (error) {
    console.error('Update KOT item status error:', error);
    res.status(500).json({ error: 'Failed to update item status', details: error.message });
  }
};

module.exports = {
  createKOT,
  getKOTs,
  getKOTById,
  updateKOTStatus,
  updateKOTPriority,
  printKOT,
  getKitchenDashboard,
  deleteKOT,
  updateKOTItemStatus
};