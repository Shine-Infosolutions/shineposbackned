const createAddon = async (req, res) => {
    try {
        const { name, price, description, veg, available } = req.body;
        const Addon = req.tenantModels.Addon;
        
        const existingAddon = await Addon.findOne({ name });
        if (existingAddon) {
            return res.status(400).json({ error: 'Addon already exists' });
        }

        const addon = new Addon({ name, price, description, veg, available });
        await addon.save();
        
        res.status(201).json({ message: 'Addon created successfully', addon });
    } catch (error) {
        console.error('Create addon error:', error);
        res.status(500).json({ error: 'Failed to create addon' });
    }
};

const getAddons = async (req, res) => {
    try {
        const Addon = req.tenantModels.Addon;
        const addons = await Addon.find().sort({ createdAt: -1 });
        res.json({ addons });
    } catch (error) {
        console.error('Get addons error:', error);
        res.status(500).json({ error: 'Failed to fetch addons' });
    }
};

const getAddonById = async (req, res) => {
    try {
        const { id } = req.params;
        const Addon = req.tenantModels.Addon;
        
        const addon = await Addon.findById(id);
        if (!addon) {
            return res.status(404).json({ error: 'Addon not found' });
        }
        
        res.json({ addon });
    } catch (error) {
        console.error('Get addon by ID error:', error);
        res.status(500).json({ error: 'Failed to fetch addon' });
    }
};

const updateAddon = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, price, description, veg, available } = req.body;
        const Addon = req.tenantModels.Addon;
        
        const addon = await Addon.findById(id);
        if (!addon) {
            return res.status(404).json({ error: 'Addon not found' });
        }
        
        if (name !== undefined) addon.name = name;
        if (price !== undefined) addon.price = price;
        if (description !== undefined) addon.description = description;
        if (veg !== undefined) addon.veg = veg;
        if (available !== undefined) addon.available = available;
        
        await addon.save();
        
        res.json({ message: 'Addon updated successfully', addon });
    } catch (error) {
        console.error('Update addon error:', error);
        res.status(500).json({ error: 'Failed to update addon' });
    }
};

const deleteAddon = async (req, res) => {
    try {
        const { id } = req.params;
        const Addon = req.tenantModels.Addon;
        
        const addon = await Addon.findByIdAndDelete(id);
        if (!addon) {
            return res.status(404).json({ error: 'Addon not found' });
        }
        
        res.json({ message: 'Addon deleted successfully' });
    } catch (error) {
        console.error('Delete addon error:', error);
        res.status(500).json({ error: 'Failed to delete addon' });
    }
};

module.exports = {
    createAddon,
    getAddons,
    getAddonById,
    updateAddon,
    deleteAddon
};