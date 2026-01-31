const cloudinary = require('../config/cloudinary');
const Restaurant = require('../models/Restaurant');

const createMenuItem = async (req, res) => {
    try {
        console.log('req.tenantModels:', req.tenantModels);
        console.log('req.user:', req.user);
        
        if (!req.tenantModels) {
            return res.status(500).json({ error: 'Tenant models not initialized' });
        }
        
        const { itemName, categoryID, price, status, imageUrl, videoUrl, timeToPrepare, foodType, addon, variation } = req.body;
        const MenuItem = req.tenantModels.MenuItem;
        
        const menuItem = new MenuItem({
            itemName,
            categoryID,
            price,
            status,
            imageUrl,
            videoUrl,
            timeToPrepare,
            foodType,
            addon,
            variation
        });
        
        await menuItem.save();
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
            .select('itemName categoryID price status imageUrl timeToPrepare foodType addon variation')
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
        
        const menuItem = await MenuItem.findById(id);
        if (!menuItem) {
            return res.status(404).json({ error: 'Menu item not found' });
        }
        
        Object.assign(menuItem, req.body);
        await menuItem.save();
        
        await menuItem.populate('categoryID');
        await menuItem.populate('addon');
        await menuItem.populate('variation');
        
        res.json({ message: 'Menu item updated successfully', menuItem });
    } catch (error) {
        console.error('Update menu item error:', error);
        res.status(500).json({ error: 'Failed to update menu item' });
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
        const Restaurant = require('../models/Restaurant');
        
        const restaurant = await Restaurant.findOne({ slug: req.params.restaurantSlug, isActive: true });
        if (!restaurant) {
            return res.status(404).json({ error: 'Restaurant not found' });
        }
        
        const categories = await Category.find().sort({ name: 1 });
        const menuData = [];
        
        for (const category of categories) {
            const items = await MenuItem.find({
                categoryID: category._id
            })
            .populate('variation', 'name price')
            .populate('addon', 'name price')
            .lean();
            
            const formattedItems = items.map(item => ({
                id: item._id,
                name: item.itemName,
                description: item.description || '',
                image: item.imageUrl || '',
                video: item.videoUrl || '',
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