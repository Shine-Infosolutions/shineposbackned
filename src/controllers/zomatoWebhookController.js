const TenantModelFactory = require('../models/TenantModelFactory');

const getItems = async (req, res) => {
  res.json({ message: 'GET items endpoint', resId: req.params.resId });
};

const postItems = async (req, res) => {
  try {
    const { resId } = req.params;
    const { restaurantSlug, items } = req.body;

    if (!restaurantSlug || !items) {
      return res.status(400).json({ error: 'Missing restaurantSlug or items' });
    }

    const CategoryModel = TenantModelFactory.getCategoryModel(restaurantSlug);
    const MenuModel = TenantModelFactory.getMenuItemModel(restaurantSlug);
    const VariationModel = TenantModelFactory.getVariationModel(restaurantSlug);

    const stats = { categories: 0, items: 0, variations: 0 };

    const categoryItemsMap = {};
    for (const catWrapper of items.categoryWrappers) {
      const catId = catWrapper.category.categoryId;
      categoryItemsMap[catId] = [];
      
      for (const subCat of catWrapper.subCategoryWrappers || []) {
        for (const entity of subCat.subCategoryEntities || []) {
          categoryItemsMap[catId].push(entity.entityId);
        }
      }
    }

    const categoryMap = {};
    for (const catWrapper of items.categoryWrappers) {
      const cat = catWrapper.category;
      
      let category = await CategoryModel.findOne({ categoryId: cat.categoryId });
      if (category) {
        category.name = cat.name;
        category.resId = cat.resId;
        category.order = cat.order;
        category.vendorEntityId = cat.vendorEntityId;
        category.lastSyncedAt = new Date();
        await category.save();
      } else {
        category = await CategoryModel.create({
          categoryId: cat.categoryId,
          resId: cat.resId,
          name: cat.name,
          order: cat.order,
          vendorEntityId: cat.vendorEntityId,
          lastSyncedAt: new Date()
        });
      }
      categoryMap[cat.categoryId] = category;
      stats.categories++;
    }

    for (const itemWrapper of items.catalogueWrappers) {
      const item = itemWrapper.catalogue;
      
      let category = null;
      for (const [catId, itemIds] of Object.entries(categoryItemsMap)) {
        if (itemIds.includes(item.catalogueId)) {
          category = categoryMap[catId];
          break;
        }
      }

      if (!category) continue;

      let foodType = 'veg';
      if (item.tagsWithStatus?.some(t => t.slug === 'egg')) foodType = 'egg';
      else if (item.meatTypes?.length > 0) foodType = 'nonveg';

      const variationIds = [];
      for (const varWrapper of itemWrapper.variantWrappers || []) {
        const variant = varWrapper.variant;
        const varPrice = varWrapper.variantPrices?.[0];

        let variation = await VariationModel.findOne({ variantId: variant.variantId });
        if (variation) {
          variation.catalogueId = item.catalogueId;
          variation.name = 'Regular';
          variation.price = varPrice?.price || 0;
          variation.basePrice = varPrice?.basePrice;
          variation.historyPrice = varPrice?.historyPrice;
          variation.maxAllowedPrice = varPrice?.maxAllowedPrice;
          variation.inStock = variant.inStock;
          variation.vendorEntityId = variant.vendorEntityId;
          variation.lastSyncedAt = new Date();
          await variation.save();
        } else {
          variation = await VariationModel.create({
            variantId: variant.variantId,
            catalogueId: item.catalogueId,
            name: 'Regular',
            price: varPrice?.price || 0,
            basePrice: varPrice?.basePrice,
            historyPrice: varPrice?.historyPrice,
            maxAllowedPrice: varPrice?.maxAllowedPrice,
            inStock: variant.inStock,
            vendorEntityId: variant.vendorEntityId,
            lastSyncedAt: new Date()
          });
        }
        variationIds.push(variation._id);
        stats.variations++;
      }

      let menuItem = await MenuModel.findOne({ catalogueId: item.catalogueId });
      if (menuItem) {
        menuItem.resId = item.resId;
        menuItem.itemName = item.name;
        menuItem.description = item.description;
        menuItem.categoryID = category._id;
        menuItem.imageUrl = item.imageUrl || item.imageUrlV2;
        menuItem.imageHash = item.imageHash;
        menuItem.thumbUrl = item.thumbUrl;
        menuItem.inStock = item.inStock;
        menuItem.foodType = foodType;
        menuItem.tags = itemWrapper.catalogueTags || [];
        menuItem.variation = variationIds;
        menuItem.vendorEntityId = item.vendorEntityId;
        menuItem.lastSyncedAt = new Date();
        await menuItem.save();
      } else {
        menuItem = await MenuModel.create({
          catalogueId: item.catalogueId,
          resId: item.resId,
          itemName: item.name,
          description: item.description,
          categoryID: category._id,
          imageUrl: item.imageUrl || item.imageUrlV2,
          imageHash: item.imageHash,
          thumbUrl: item.thumbUrl,
          inStock: item.inStock,
          foodType: foodType,
          tags: itemWrapper.catalogueTags || [],
          variation: variationIds,
          vendorEntityId: item.vendorEntityId,
          timeToPrepare: 15,
          lastSyncedAt: new Date()
        });
      }
      stats.items++;
    }

    res.json({ success: true, message: 'Items synced successfully', stats });
  } catch (error) {
    console.error('POST items error:', error);
    res.status(500).json({ error: 'Failed to sync items' });
  }
};

const updateCategoryStatus = async (req, res) => {
  res.json({ message: 'Category status updated', body: req.body });
};

const updateItemStatus = async (req, res) => {
  res.json({ message: 'Item status updated', body: req.body });
};

module.exports = { getItems, postItems, updateCategoryStatus, updateItemStatus };
