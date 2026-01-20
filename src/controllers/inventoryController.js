const TenantModelFactory = require('../models/TenantModelFactory');

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
    
    const inventoryItem = await InventoryModel.findById(id);
    if (!inventoryItem) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    inventoryItem.currentStock += quantity;
    inventoryItem.lastRestocked = new Date();
    await inventoryItem.save();

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
  createInventoryItem,
  getInventory,
  updateInventoryItem,
  restockItem,
  getLowStockItems,
  deleteInventoryItem
};