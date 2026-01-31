const TenantModelFactory = require('../models/TenantModelFactory');
const Restaurant = require('../models/Restaurant');

const getPublicDigitalMenu = async (req, res) => {
  try {
    const { restaurantSlug } = req.params;
    
    const restaurant = await Restaurant.findOne({ slug: restaurantSlug, isActive: true });
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    
    const MenuItem = TenantModelFactory.getMenuItemModel(restaurantSlug);
    const Category = TenantModelFactory.getCategoryModel(restaurantSlug);
    const Variation = TenantModelFactory.getVariationModel(restaurantSlug);
    
    const categories = await Category.find({ isActive: true }).sort({ name: 1 });
    const menuData = [];
    
    for (const category of categories) {
      const items = await MenuItem.find({
        categoryID: category._id,
        status: 'active',
        inStock: true
      })
      .populate('variation', 'name price')
      .populate('addon', 'name price')
      .lean();
      
      const formattedItems = items.map(item => ({
        id: item._id,
        name: item.itemName,
        description: item.description || '',
        image: item.imageUrl || '',
        foodType: item.foodType,
        variations: item.variation?.map(v => ({
          id: v._id,
          name: v.name,
          price: v.price
        })) || [],
        addons: item.addon?.map(a => ({
          id: a._id,
          name: a.name,
          price: a.price
        })) || [],
        timeToPrepare: item.timeToPrepare || 15
      }));
      
      if (formattedItems.length > 0) {
        menuData.push({
          categoryId: category._id,
          categoryName: category.name,
          items: formattedItems
        });
      }
    }
    
    res.json({
      restaurant: {
        name: restaurant.name,
        slug: restaurant.slug,
        logo: restaurant.logo
      },
      menu: menuData
    });
  } catch (error) {
    console.error('Get public digital menu error:', error);
    res.status(500).json({ error: 'Failed to fetch digital menu' });
  }
};

module.exports = {
  getPublicDigitalMenu
};