const createVariation = async (req, res) => {
    try {
        const { name, price, available } = req.body;
        const Variation = req.tenantModels.Variation;
        
        const existingVariation = await Variation.findOne({ name });
        if (existingVariation) {
            return res.status(400).json({ error: 'Variation already exists' });
        }

        const variation = new Variation({ name, price, available });
        await variation.save();
        
        res.status(201).json({ message: 'Variation created successfully', variation });
    } catch (error) {
        console.error('Create variation error:', error);
        res.status(500).json({ error: 'Failed to create variation' });
    }
};

const getVariations = async (req, res) => {
    try {
        const Variation = req.tenantModels.Variation;
        const variations = await Variation.find().sort({ createdAt: -1 });
        res.json({ variations });
    } catch (error) {
        console.error('Get variations error:', error);
        res.status(500).json({ error: 'Failed to fetch variations' });
    }
};

const getVariationById = async (req, res) => {
    try {
        const { id } = req.params;
        const Variation = req.tenantModels.Variation;
        
        const variation = await Variation.findById(id);
        if (!variation) {
            return res.status(404).json({ error: 'Variation not found' });
        }
        
        res.json({ variation });
    } catch (error) {
        console.error('Get variation by ID error:', error);
        res.status(500).json({ error: 'Failed to fetch variation' });
    }
};

const updateVariation = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, price, available } = req.body;
        const Variation = req.tenantModels.Variation;
        
        const variation = await Variation.findByIdAndUpdate(
            id,
            { name, price, available },
            { new: true }
        );
        
        if (!variation) {
            return res.status(404).json({ error: 'Variation not found' });
        }
        
        res.json({ message: 'Variation updated successfully', variation });
    } catch (error) {
        console.error('Update variation error:', error);
        res.status(500).json({ error: 'Failed to update variation' });
    }
};

const deleteVariation = async (req, res) => {
    try {
        const { id } = req.params;
        const Variation = req.tenantModels.Variation;
        
        const variation = await Variation.findByIdAndDelete(id);
        if (!variation) {
            return res.status(404).json({ error: 'Variation not found' });
        }
        
        res.json({ message: 'Variation deleted successfully' });
    } catch (error) {
        console.error('Delete variation error:', error);
        res.status(500).json({ error: 'Failed to delete variation' });
    }
};

module.exports = {
    createVariation,
    getVariations,
    getVariationById,
    updateVariation,
    deleteVariation
};