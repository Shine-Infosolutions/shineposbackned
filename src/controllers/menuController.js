const createMenu = async (req, res) => {
  try {
    const restaurantSlug = req.user.restaurantSlug;
    const TimeBasedSubscriptionService = require('../services/TimeBasedSubscriptionService');
    
    // Check if subscription is active (time-based)
    await TimeBasedSubscriptionService.checkSubscriptionStatus(restaurantSlug);
    
    if (!req.tenantModels || !req.tenantModels.Menu) {
      return res.status(500).json({ error: 'Restaurant database not found' });
    }
    
    const MenuModel = req.tenantModels.Menu;
    const { name, description, price, category } = req.body;

    const menuItem = new MenuModel({
      name,
      description,
      price: parseFloat(price),
      category,
      isAvailable: true
    });

    await menuItem.save();
    res.status(201).json({ message: 'Menu item created successfully', menuItem });
  } catch (error) {
    console.error('Create menu error:', error);
    res.status(500).json({ error: error.message || 'Failed to create menu item' });
  }
};

const getMenus = async (req, res) => {
  try {
    const MenuModel = req.tenantModels.Menu;
    const menus = await MenuModel.find().sort({ createdAt: -1 });
    res.json({ menus });
  } catch (error) {
    console.error('Get menus error:', error);
    res.status(500).json({ error: 'Failed to fetch menus' });
  }
};

const updateMenu = async (req, res) => {
  try {
    const { id } = req.params;
    const MenuModel = req.tenantModels.Menu;
    
    const menuItem = await MenuModel.findByIdAndUpdate(id, req.body, { new: true });
    if (!menuItem) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    res.json({ message: 'Menu item updated successfully', menuItem });
  } catch (error) {
    console.error('Update menu error:', error);
    res.status(500).json({ error: 'Failed to update menu item' });
  }
};

const deleteMenu = async (req, res) => {
  try {
    const { id } = req.params;
    const MenuModel = req.tenantModels.Menu;
    
    const menuItem = await MenuModel.findByIdAndDelete(id);
    if (!menuItem) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    res.json({ message: 'Menu item deleted successfully' });
  } catch (error) {
    console.error('Delete menu error:', error);
    res.status(500).json({ error: 'Failed to delete menu item' });
  }
};

module.exports = {
  createMenu,
  getMenus,
  updateMenu,
  deleteMenu
};