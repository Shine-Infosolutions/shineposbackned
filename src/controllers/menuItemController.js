const cloudinary = require('../config/cloudinary');

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
        const menuItems = await MenuItem.find().populate('categoryID').populate('addon').populate('variation').sort({ createdAt: -1 });
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
        
        const menuItem = await MenuItem.findById(id).populate('categoryID').populate('addon').populate('variation');
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

module.exports = {
    createMenuItem,
    getMenuItems,
    getMenuItemById,
    updateMenuItem,
    deleteMenuItem,
    uploadMenuMedia
};