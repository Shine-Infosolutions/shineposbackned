const cloudinary = require('../config/cloudinary');
const Restaurant = require('../models/Restaurant');
const TenantModelFactory = require('../models/TenantModelFactory');

const createMenuItem = async (req, res) => {
    try {
        if (!req.tenantModels) {
            return res.status(500).json({ error: 'Tenant models not initialized' });
        }
        
        const { itemName, categoryID, price, status, imageUrl, videoUrl, timeToPrepare, foodType, addon, variation, ingredients } = req.body;
        const MenuItem = req.tenantModels.MenuItem;
        
        const menuItem = new MenuItem({
            itemName, categoryID, price, status, imageUrl, videoUrl, timeToPrepare, foodType, addon, variation
        });
        
        await menuItem.save();

        // Auto-create/update recipe if ingredients provided
        if (ingredients && ingredients.length > 0) {
            const restaurantSlug = req.user.restaurantSlug;
            const RecipeModel = TenantModelFactory.getRecipeModel(restaurantSlug);
            const normalizedIngredients = ingredients.map(ing => ({
                inventoryItemId: new (require('mongoose').Types.ObjectId)(ing.inventoryItemId),
                quantity: Number(ing.quantity),
                unit: String(ing.unit)
            }));
            await RecipeModel.collection.findOneAndReplace(
                { menuItemId: menuItem._id },
                { menuItemId: menuItem._id, ingredients: normalizedIngredients, createdAt: new Date(), updatedAt: new Date() },
                { upsert: true }
            );
        }

        res.status(201).json({ message: 'Menu item created successfully', menuItem });
    } catch (error) {
        console.error('Create menu item error:', error);
        res.status(500).json({ error: 'Failed to create menu item' });
    }
};

const getMenuItems = async (req, res) => {
    try {
        const MenuItem = req.tenantModels.MenuItem;
        const menuItems = await MenuItem.find()
            .populate('categoryID', 'name')
            .populate('addon', 'name price')
            .populate('variation', 'name price')
            .lean()
            .sort({ createdAt: -1 });
        res.json({ menuItems });
    } catch (error) {
        console.error('Get menu items error:', error);
        res.status(500).json({ error: 'Failed to fetch menu items' });
    }
};

const getMenuItemById = async (req, res) => {
    try {
        const { id } = req.params;
        const MenuItem = req.tenantModels.MenuItem;
        
        const menuItem = await MenuItem.findById(id)
            .populate('categoryID', 'name')
            .populate('addon', 'name price')
            .populate('variation', 'name price')
            .lean();
        
        if (!menuItem) {
            return res.status(404).json({ error: 'Menu item not found' });
        }

        // Attach recipe/ingredients if exists
        const restaurantSlug = req.user.restaurantSlug;
        const RecipeModel = TenantModelFactory.getRecipeModel(restaurantSlug);
        const recipe = await RecipeModel.findOne({ menuItemId: id }).lean();
        menuItem.ingredients = recipe ? recipe.ingredients : [];
        
        res.json({ menuItem });
    } catch (error) {
        console.error('Get menu item error:', error);
        res.status(500).json({ error: 'Failed to fetch menu item' });
    }
};

const updateMenuItem = async (req, res) => {
    try {
        const { id } = req.params;
        const MenuItem = req.tenantModels.MenuItem;

        // Only set fields that are actually provided in the request
        const updateData = {};
        const fields = ['itemName', 'categoryID', 'status', 'imageUrl', 'videoUrl', 'timeToPrepare', 'foodType', 'addon', 'variation', 'marginCostPercentage'];
        fields.forEach(field => {
            if (req.body[field] !== undefined) updateData[field] = req.body[field];
        });

        const menuItem = await MenuItem.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true }
        );
        
        if (!menuItem) {
            return res.status(404).json({ error: 'Menu item not found' });
        }

        await menuItem.populate('categoryID');
        await menuItem.populate('addon');
        await menuItem.populate('variation');

        // Auto-create/update recipe if ingredients provided
        if (req.body.ingredients !== undefined) {
            const restaurantSlug = req.user.restaurantSlug;
            const RecipeModel = TenantModelFactory.getRecipeModel(restaurantSlug);
            if (req.body.ingredients && req.body.ingredients.length > 0) {
                const ingredients = req.body.ingredients.map(ing => ({
                    inventoryItemId: new (require('mongoose').Types.ObjectId)(ing.inventoryItemId),
                    quantity: Number(ing.quantity),
                    unit: String(ing.unit)
                }));
                // Use native driver to bypass all Mongoose validation/casting issues
                const result = await RecipeModel.collection.findOneAndReplace(
                    { menuItemId: new (require('mongoose').Types.ObjectId)(id) },
                    { menuItemId: new (require('mongoose').Types.ObjectId)(id), ingredients, updatedAt: new Date(), createdAt: new Date() },
                    { upsert: true, returnDocument: 'after' }
                );
            } else {
                await RecipeModel.collection.deleteOne({ menuItemId: new (require('mongoose').Types.ObjectId)(id) });
            }
        }
        
        res.json({ message: 'Menu item updated successfully', menuItem });
    } catch (error) {
        console.error('Update menu item error:', error);
        res.status(500).json({ error: 'Failed to update menu item', details: error.message });
    }
};

const deleteMenuItem = async (req, res) => {
    try {
        const { id } = req.params;
        const MenuItem = req.tenantModels.MenuItem;
        
        const menuItem = await MenuItem.findByIdAndDelete(id);
        if (!menuItem) {
            return res.status(404).json({ error: 'Menu item not found' });
        }
        
        res.json({ message: 'Menu item deleted successfully' });
    } catch (error) {
        console.error('Delete menu item error:', error);
        res.status(500).json({ error: 'Failed to delete menu item' });
    }
};

const uploadMenuMedia = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const isVideo = req.file.mimetype.startsWith('video/');
        
        const result = await new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream(
                {
                    resource_type: isVideo ? 'video' : 'image',
                    folder: `pos-shine/${req.tenantId}/menu-items`,
                },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                }
            ).end(req.file.buffer);
        });

        res.json({
            success: true,
            url: result.secure_url,
            publicId: result.public_id,
            type: isVideo ? 'video' : 'image'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getDigitalMenu = async (req, res) => {
    try {
        const MenuItem = req.tenantModels.MenuItem;
        const Category = req.tenantModels.Category;
        const RestaurantModel = require('../models/Restaurant');
        
        const restaurant = await RestaurantModel.findOne({ slug: req.params.restaurantSlug, isActive: true }).lean();
        if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });
        
        // Batch fetch categories and all active menu items in 2 queries
        const [categories, allItems] = await Promise.all([
            Category.find().sort({ name: 1 }).lean(),
            MenuItem.find({ status: 'active' })
                .populate('variation', 'name price')
                .populate('addon', 'name price')
                .lean()
        ]);

        // Group items by categoryID in memory
        const itemsByCategory = {};
        allItems.forEach(item => {
            const catId = item.categoryID?.toString();
            if (catId) {
                if (!itemsByCategory[catId]) itemsByCategory[catId] = [];
                itemsByCategory[catId].push(item);
            }
        });

        const menuData = categories
            .map(category => {
                const items = (itemsByCategory[category._id.toString()] || []).map(item => ({
                    id: item._id, name: item.itemName, description: item.description || '',
                    image: item.imageUrl || '', video: item.videoUrl || '', foodType: item.foodType,
                    variations: item.variation?.map(v => ({ id: v._id, name: v.name, price: v.price })) || [],
                    addons: item.addon?.map(a => ({ id: a._id, name: a.name, price: a.price })) || [],
                    timeToPrepare: item.timeToPrepare || 15
                }));
                return items.length > 0 ? { categoryId: category._id, categoryName: category.name, items } : null;
            })
            .filter(Boolean);
        
        res.json({
            restaurant: { name: restaurant.name, slug: restaurant.slug, logo: restaurant.logo },
            menu: menuData
        });
    } catch (error) {
        console.error('Get digital menu error:', error);
        res.status(500).json({ error: 'Failed to fetch digital menu' });
    }
};

module.exports = {
    createMenuItem,
    getMenuItems,
    getMenuItemById,
    updateMenuItem,
    deleteMenuItem,
    uploadMenuMedia,
    getDigitalMenu
};