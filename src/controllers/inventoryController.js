const TenantModelFactory = require('../models/TenantModelFactory');

// Shared helper: deduct inventory for a list of order items
const deductInventoryForItems = async (restaurantSlug, items) => {
  const RecipeModel = TenantModelFactory.getRecipeModel(restaurantSlug);
  const InventoryModel = TenantModelFactory.getInventoryModel(restaurantSlug);
  const LogModel = TenantModelFactory.getInventoryLogModel(restaurantSlug);
  const { ObjectId } = require('mongoose').Types;

  // Batch fetch all recipes in one query
  const menuIds = items.map(i => new ObjectId(i.menuId)).filter(Boolean);
  if (menuIds.length === 0) return;

  const recipes = await RecipeModel.collection.find({ menuItemId: { $in: menuIds } }).toArray();
  const recipeMap = {};
  recipes.forEach(r => { recipeMap[r.menuItemId.toString()] = r; });

  const deductions = [];
  for (const orderItem of items) {
    const recipe = recipeMap[orderItem.menuId?.toString()];
    if (recipe?.ingredients?.length > 0) {
      for (const ingredient of recipe.ingredients) {
        deductions.push({
          inventoryItemId: new ObjectId(ingredient.inventoryItemId),
          quantity: ingredient.quantity * orderItem.quantity,
          orderItemName: orderItem.name || 'item',
          orderItemQty: orderItem.quantity
        });
      }
    }
  }

  if (deductions.length === 0) return;

  const connection = TenantModelFactory.getTenantConnection(restaurantSlug);
  const session = await connection.startSession();
  try {
    await session.withTransaction(async () => {
      // Batch fetch all inventory items needed
      const invIds = [...new Set(deductions.map(d => d.inventoryItemId.toString()))]
        .map(id => new ObjectId(id));
      const invItems = await InventoryModel.collection.find({ _id: { $in: invIds } }, { session }).toArray();
      const invMap = {};
      invItems.forEach(i => { invMap[i._id.toString()] = i; });

      for (const d of deductions) {
        const invItem = invMap[d.inventoryItemId.toString()];
        await InventoryModel.collection.updateOne(
          { _id: d.inventoryItemId },
          { $inc: { currentStock: -d.quantity } },
          { session }
        );
        await LogModel.collection.insertOne({
          inventoryItemId: d.inventoryItemId,
          itemName: invItem?.name || '',
          type: 'order_deduction',
          quantity: -d.quantity,
          note: `Order deduction for ${d.orderItemName} x${d.orderItemQty}`,
          createdAt: new Date(), updatedAt: new Date()
        }, { session });
      }
    });
  } catch (err) {
    console.error('Inventory deduction error:', err);
  } finally {
    await session.endSession();
  }
};

// Shared helper: restock inventory when order is cancelled
const restockInventoryForItems = async (restaurantSlug, items, orderNumber) => {
  const RecipeModel = TenantModelFactory.getRecipeModel(restaurantSlug);
  const InventoryModel = TenantModelFactory.getInventoryModel(restaurantSlug);
  const LogModel = TenantModelFactory.getInventoryLogModel(restaurantSlug);
  const { ObjectId } = require('mongoose').Types;

  // Batch fetch all recipes in one query
  const menuIds = items.map(i => new ObjectId(i.menuId)).filter(Boolean);
  if (menuIds.length === 0) return;

  const recipes = await RecipeModel.collection.find({ menuItemId: { $in: menuIds } }).toArray();
  const recipeMap = {};
  recipes.forEach(r => { recipeMap[r.menuItemId.toString()] = r; });

  const restocks = [];
  for (const orderItem of items) {
    const recipe = recipeMap[orderItem.menuId?.toString()];
    if (recipe?.ingredients?.length > 0) {
      for (const ingredient of recipe.ingredients) {
        restocks.push({
          inventoryItemId: new ObjectId(ingredient.inventoryItemId),
          quantity: ingredient.quantity * orderItem.quantity,
          orderItemName: orderItem.name || 'item',
          orderItemQty: orderItem.quantity
        });
      }
    }
  }

  if (restocks.length === 0) return;

  const connection = TenantModelFactory.getTenantConnection(restaurantSlug);
  const session = await connection.startSession();
  try {
    await session.withTransaction(async () => {
      // Batch fetch all inventory items needed
      const invIds = [...new Set(restocks.map(r => r.inventoryItemId.toString()))]
        .map(id => new ObjectId(id));
      const invItems = await InventoryModel.collection.find({ _id: { $in: invIds } }, { session }).toArray();
      const invMap = {};
      invItems.forEach(i => { invMap[i._id.toString()] = i; });

      for (const r of restocks) {
        const invItem = invMap[r.inventoryItemId.toString()];
        await InventoryModel.collection.updateOne(
          { _id: r.inventoryItemId },
          { $inc: { currentStock: r.quantity } },
          { session }
        );
        await LogModel.collection.insertOne({
          inventoryItemId: r.inventoryItemId,
          itemName: invItem?.name || '',
          type: 'order_cancellation',
          quantity: r.quantity,
          note: `Restocked due to order cancellation (${orderNumber}) - ${r.orderItemName} x${r.orderItemQty}`,
          createdAt: new Date(), updatedAt: new Date()
        }, { session });
      }
    });
  } catch (err) {
    console.error('Inventory restock error:', err);
  } finally {
    await session.endSession();
  }
};

// Recipe Management
const createRecipe = async (req, res) => {
  try {
    const restaurantSlug = req.user.restaurantSlug;
    const RecipeModel = TenantModelFactory.getRecipeModel(restaurantSlug);
    const recipe = new RecipeModel(req.body);
    await recipe.save();
    res.json({ recipe });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getRecipes = async (req, res) => {
  try {
    const restaurantSlug = req.user.restaurantSlug;
    const RecipeModel = TenantModelFactory.getRecipeModel(restaurantSlug);
    const recipes = await RecipeModel.find().populate('menuItemId').populate('ingredients.inventoryItemId');
    res.json({ recipes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const processOrder = async (req, res) => {
  try {
    const { orderId } = req.body;
    const restaurantSlug = req.user.restaurantSlug;
    const OrderModel = TenantModelFactory.getOrderModel(restaurantSlug);
    const order = await OrderModel.findById(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    await deductInventoryForItems(restaurantSlug, [...order.items, ...(order.extraItems || [])]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Wastage Management
const createWastage = async (req, res) => {
  try {
    const restaurantSlug = req.user.restaurantSlug;
    const WastageModel = TenantModelFactory.getWastageModel(restaurantSlug);
    const InventoryModel = TenantModelFactory.getInventoryModel(restaurantSlug);
    const LogModel = TenantModelFactory.getInventoryLogModel(restaurantSlug);
    
    const wastage = new WastageModel({ ...req.body, recordedBy: req.user.id });
    await wastage.save();
    
    const invItem = await InventoryModel.findById(req.body.inventoryItemId);
    await InventoryModel.findByIdAndUpdate(
      req.body.inventoryItemId,
      { $inc: { currentStock: -req.body.quantity } }
    );

    await LogModel.collection.insertOne({
      inventoryItemId: wastage.inventoryItemId,
      itemName: invItem?.name || '',
      type: 'wastage',
      quantity: -req.body.quantity,
      note: `Wastage: ${req.body.reason}`,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    res.json({ wastage });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getWastage = async (req, res) => {
  try {
    const restaurantSlug = req.user.restaurantSlug;
    const WastageModel = TenantModelFactory.getWastageModel(restaurantSlug);
    const wastage = await WastageModel.find().populate('inventoryItemId').sort({ date: -1 });
    res.json({ wastage });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Vendor Management
const createVendor = async (req, res) => {
  try {
    const restaurantSlug = req.user.restaurantSlug;
    const VendorModel = TenantModelFactory.getVendorModel(restaurantSlug);
    const vendor = new VendorModel(req.body);
    await vendor.save();
    res.json({ vendor });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getVendors = async (req, res) => {
  try {
    const restaurantSlug = req.user.restaurantSlug;
    const VendorModel = TenantModelFactory.getVendorModel(restaurantSlug);
    const vendors = await VendorModel.find({ isActive: true });
    res.json({ vendors });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createVendorPrice = async (req, res) => {
  try {
    const restaurantSlug = req.user.restaurantSlug;
    const VendorPriceModel = TenantModelFactory.getVendorPriceModel(restaurantSlug);
    const vendorPrice = new VendorPriceModel(req.body);
    await vendorPrice.save();
    res.json({ vendorPrice });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getVendorPrices = async (req, res) => {
  try {
    const restaurantSlug = req.user.restaurantSlug;
    const VendorPriceModel = TenantModelFactory.getVendorPriceModel(restaurantSlug);
    const prices = await VendorPriceModel.find()
      .populate('vendorId')
      .populate('inventoryItemId');
    res.json({ prices });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Sales Analytics for Prediction
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

// Purchase Order Management
const createPurchaseOrder = async (req, res) => {
  try {
    const restaurantSlug = req.user.restaurantSlug;
    const PurchaseOrderModel = TenantModelFactory.getPurchaseOrderModel(restaurantSlug);
    const purchaseOrder = new PurchaseOrderModel({ ...req.body, createdBy: req.user.id });
    await purchaseOrder.save();
    res.json({ purchaseOrder });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getPurchaseOrders = async (req, res) => {
  try {
    const restaurantSlug = req.user.restaurantSlug;
    const PurchaseOrderModel = TenantModelFactory.getPurchaseOrderModel(restaurantSlug);
    const orders = await PurchaseOrderModel.find().sort({ createdAt: -1 });
    res.json({ orders });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updatePurchaseOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const restaurantSlug = req.user.restaurantSlug;
    const PurchaseOrderModel = TenantModelFactory.getPurchaseOrderModel(restaurantSlug);
    
    const order = await PurchaseOrderModel.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );
    
    res.json({ order });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getStockLogs = async (req, res) => {
  try {
    const restaurantSlug = req.user.restaurantSlug;
    const LogModel = TenantModelFactory.getInventoryLogModel(restaurantSlug);
    const { type, itemId, from, to } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (itemId) filter.inventoryItemId = new (require('mongoose').Types.ObjectId)(itemId);
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }
    const logs = await LogModel.collection.find(filter).sort({ createdAt: -1 }).limit(500).toArray();
    res.json({ logs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createInventoryItem = async (req, res) => {
  try {
    const { name, category, currentStock, minStock, unit, costPerUnit, supplier } = req.body;
    const restaurantSlug = req.user.restaurantSlug;
    
    const InventoryModel = TenantModelFactory.getInventoryModel(restaurantSlug);
    const inventoryItem = new InventoryModel({
      name,
      category,
      currentStock,
      minStock,
      unit,
      costPerUnit,
      supplier
    });

    await inventoryItem.save();
    res.status(201).json({ message: 'Inventory item created successfully', inventoryItem });
  } catch (error) {
    console.error('Create inventory error:', error);
    res.status(500).json({ error: 'Failed to create inventory item' });
  }
};

const getInventory = async (req, res) => {
  try {
    const restaurantSlug = req.user.restaurantSlug;
    const InventoryModel = TenantModelFactory.getInventoryModel(restaurantSlug);
    
    const inventory = await InventoryModel.find({ isActive: true }).sort({ createdAt: -1 });
    
    // Add low stock alerts
    const inventoryWithAlerts = inventory.map(item => ({
      ...item.toObject(),
      isLowStock: item.currentStock <= item.minStock
    }));
    
    res.json({ inventory: inventoryWithAlerts });
  } catch (error) {
    console.error('Get inventory error:', error);
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
};

const updateInventoryItem = async (req, res) => {
  try {
    const { id } = req.params;
    const restaurantSlug = req.user.restaurantSlug;
    const InventoryModel = TenantModelFactory.getInventoryModel(restaurantSlug);
    
    const inventoryItem = await InventoryModel.findById(id);
    if (!inventoryItem) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }
    
    Object.assign(inventoryItem, req.body);
    await inventoryItem.save();

    res.json({ message: 'Inventory item updated successfully', inventoryItem });
  } catch (error) {
    console.error('Update inventory error:', error);
    res.status(500).json({ error: 'Failed to update inventory item' });
  }
};

const restockItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;
    const restaurantSlug = req.user.restaurantSlug;
    const InventoryModel = TenantModelFactory.getInventoryModel(restaurantSlug);
    const LogModel = TenantModelFactory.getInventoryLogModel(restaurantSlug);
    
    const inventoryItem = await InventoryModel.findById(id);
    if (!inventoryItem) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    inventoryItem.currentStock += quantity;
    inventoryItem.lastRestocked = new Date();
    await inventoryItem.save();

    await LogModel.collection.insertOne({
      inventoryItemId: inventoryItem._id,
      itemName: inventoryItem.name,
      type: 'restock',
      quantity: quantity,
      note: `Restocked by ${req.user.name || req.user.email || 'admin'}`,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    res.json({ message: 'Item restocked successfully', inventoryItem });
  } catch (error) {
    console.error('Restock error:', error);
    res.status(500).json({ error: 'Failed to restock item' });
  }
};

const getLowStockItems = async (req, res) => {
  try {
    const restaurantSlug = req.user.restaurantSlug;
    const InventoryModel = TenantModelFactory.getInventoryModel(restaurantSlug);
    
    const lowStockItems = await InventoryModel.find({
      isActive: true,
      $expr: { $lte: ['$currentStock', '$minStock'] }
    });
    
    res.json({ lowStockItems });
  } catch (error) {
    console.error('Get low stock error:', error);
    res.status(500).json({ error: 'Failed to fetch low stock items' });
  }
};

const deleteInventoryItem = async (req, res) => {
  try {
    const { id } = req.params;
    const restaurantSlug = req.user.restaurantSlug;
    const InventoryModel = TenantModelFactory.getInventoryModel(restaurantSlug);
    
    const inventoryItem = await InventoryModel.findById(id);
    if (!inventoryItem) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }
    
    inventoryItem.isActive = false;
    await inventoryItem.save();

    res.json({ message: 'Inventory item deleted successfully' });
  } catch (error) {
    console.error('Delete inventory error:', error);
    res.status(500).json({ error: 'Failed to delete inventory item' });
  }
};

module.exports = {
  getStockLogs,
  deductInventoryForItems,
  restockInventoryForItems,
  createInventoryItem,
  getInventory,
  updateInventoryItem,
  restockItem,
  getLowStockItems,
  deleteInventoryItem,
  // Smart Inventory
  createRecipe,
  getRecipes,
  processOrder,
  createWastage,
  getWastage,
  createVendor,
  getVendors,
  createVendorPrice,
  getVendorPrices,
  getSalesData,
  // Purchase Orders
  createPurchaseOrder,
  getPurchaseOrders,
  updatePurchaseOrderStatus
};