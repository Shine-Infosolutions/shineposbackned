const TenantModelFactory = require('../models/TenantModelFactory');
const Restaurant = require('../models/Restaurant');

const getPublicDigitalMenu = async (req, res) => {
  try {
    const { restaurantSlug } = req.params;
    
    const restaurant = await Restaurant.findOne({ slug: restaurantSlug, isActive: true })
      .select('name slug logo').lean();
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    
    const MenuItem = TenantModelFactory.getMenuItemModel(restaurantSlug);
    const Category = TenantModelFactory.getCategoryModel(restaurantSlug);
    
    const [categories, items] = await Promise.all([
      Category.find({ isActive: true }).select('_id name').sort({ name: 1 }).lean(),
      MenuItem.find({ status: 'active', inStock: true })
        .populate('variation', 'name price')
        .populate('addon', 'name price')
        .lean()
    ]);

    // Group items by categoryID in memory
    const itemsByCategory = {};
    items.forEach(item => {
      const key = item.categoryID?.toString();
      if (!key) return;
      if (!itemsByCategory[key]) itemsByCategory[key] = [];
      itemsByCategory[key].push({
        id: item._id,
        name: item.itemName,
        description: item.description || '',
        image: item.imageUrl || '',
        foodType: item.foodType,
        variations: item.variation?.map(v => ({ id: v._id, name: v.name, price: v.price })) || [],
        addons: item.addon?.map(a => ({ id: a._id, name: a.name, price: a.price })) || [],
        timeToPrepare: item.timeToPrepare || 15
      });
    });

    const menuData = categories
      .filter(cat => itemsByCategory[cat._id.toString()]?.length > 0)
      .map(cat => ({
        categoryId: cat._id,
        categoryName: cat.name,
        items: itemsByCategory[cat._id.toString()]
      }));
    
    res.json({ restaurant, menu: menuData });
  } catch (error) {
    console.error('Get public digital menu error:', error);
    res.status(500).json({ error: 'Failed to fetch digital menu' });
  }
};

module.exports = {
  getPublicDigitalMenu
};