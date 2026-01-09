const TenantModelFactory = require('../models/TenantModelFactory');

const tenantMiddleware = (req, res, next) => {
  try {
    const restaurantSlug = req.user.restaurantSlug;
    
    if (!restaurantSlug) {
      return res.status(400).json({ error: 'Restaurant slug not found in token' });
    }

    req.tenantModels = {
      User: TenantModelFactory.getUserModel(restaurantSlug),
      Menu: TenantModelFactory.getMenuModel(restaurantSlug),
      Order: TenantModelFactory.getOrderModel(restaurantSlug),
      Inventory: TenantModelFactory.getInventoryModel(restaurantSlug),
      Staff: TenantModelFactory.getStaffModel(restaurantSlug),
      Category: TenantModelFactory.getCategoryModel(restaurantSlug),
      MenuItem: TenantModelFactory.getMenuItemModel(restaurantSlug),
      Addon: TenantModelFactory.getAddonModel(restaurantSlug),
      Variation: TenantModelFactory.getVariationModel(restaurantSlug)
    };

    next();
  } catch (error) {
    console.error('Tenant middleware error:', error);
    res.status(500).json({ error: 'Failed to load tenant data' });
  }
};

module.exports = tenantMiddleware;