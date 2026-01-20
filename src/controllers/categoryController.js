const createCategory = async (req, res) => {
    try {
        const {name, description} = req.body;
        const Category = req.tenantModels.Category;
        
        const existingCategory = await Category.findOne({ name });
        if (existingCategory) {
            return res.status(400).json({ error: 'Category already exists' });
        }

        const category = new Category({ name, description });
        await category.save();
        
        res.status(201).json({ message: 'Category created successfully', category });
    } catch (error) {
        console.error('Create category error:', error);
        res.status(500).json({ error: 'Failed to create category' });
    }
};

const getCategories = async (req, res) => {
    try {
        const Category = req.tenantModels.Category;
        const categories = await Category.find().sort({ createdAt: -1 });
        res.json({ categories });
    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
};

const updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, isActive } = req.body;
        const Category = req.tenantModels.Category;
        
        const category = await Category.findById(id);
        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }
        
        if (name !== undefined) category.name = name;
        if (description !== undefined) category.description = description;
        if (isActive !== undefined) category.isActive = isActive;
        
        await category.save();
        
        res.json({ message: 'Category updated successfully', category });
    } catch (error) {
        console.error('Update category error:', error);
        res.status(500).json({ error: 'Failed to update category' });
    }
};

const deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const Category = req.tenantModels.Category;
        
        const category = await Category.findByIdAndDelete(id);
        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }
        
        res.json({ message: 'Category deleted successfully' });
    } catch (error) {
        console.error('Delete category error:', error);
        res.status(500).json({ error: 'Failed to delete category' });
    }
};

module.exports = {
    createCategory,
    getCategories,
    updateCategory,
    deleteCategory
};
