const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');
const Restaurant = require('../models/Restaurant');
const Subscription = require('../models/Subscription');
const TenantModelFactory = require('../models/TenantModelFactory');
const { generateToken } = require('../utils/jwt');

const createRestaurant = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { name, slug, adminEmail, adminPassword, adminName, phone, address, city, state, zipCode, cuisine, description } = req.body;
    
    // Check if restaurant already exists
    const existingRestaurant = await Restaurant.findOne({ 
      $or: [{ adminEmail }, { slug }] 
    });
    if (existingRestaurant) {
      if (existingRestaurant.adminEmail === adminEmail) {
        return res.status(400).json({ error: 'Restaurant with this email already exists' });
      }
      if (existingRestaurant.slug === slug) {
        return res.status(400).json({ error: 'Restaurant slug already exists. Please choose a different slug.' });
      }
    }

    // Create restaurant
    const restaurant = new Restaurant({ 
      name,
      slug: slug.toLowerCase().trim(),
      adminEmail, 
      adminName,
      phone,
      address,
      city,
      state,
      zipCode,
      cuisine,
      description,
      subscriptionPlan: 'trial'
    });
    
    await restaurant.save();

    // Create admin user for the restaurant
    const UserModel = TenantModelFactory.getUserModel(restaurant.slug);
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    
    const adminUser = new UserModel({
      name: adminName,
      email: adminEmail,
      password: hashedPassword,
      role: 'RESTAURANT_ADMIN'
    });
    
    await adminUser.save();

    res.status(201).json({
      message: 'Restaurant registered successfully',
      restaurant: {
        id: restaurant._id,
        name: restaurant.name,
        slug: restaurant.slug,
        adminEmail: restaurant.adminEmail,
        adminName: restaurant.adminName,
        subscriptionPlan: restaurant.subscriptionPlan,
        isActive: restaurant.isActive
      }
    });
  } catch (error) {
    console.error('Create restaurant error:', error);
    res.status(500).json({ error: 'Failed to register restaurant' });
  }
};

const getRestaurants = async (req, res) => {
  try {
    const restaurants = await Restaurant.find().sort({ createdAt: -1 });
    res.json({ restaurants });
  } catch (error) {
    console.error('Get restaurants error:', error);
    res.status(500).json({ error: 'Failed to fetch restaurants' });
  }
};

const getRestaurantAnalytics = async (req, res) => {
  try {
    const restaurants = await Restaurant.find();
    const analytics = [];

    for (const restaurant of restaurants) {
      try {
        const OrderModel = TenantModelFactory.getOrderModel(restaurant.slug);
        const MenuModel = TenantModelFactory.getMenuModel(restaurant.slug);
        
        const totalOrders = await OrderModel.countDocuments();
        const totalRevenue = await OrderModel.aggregate([
          { $group: { _id: null, total: { $sum: '$total' } } }
        ]);
        const menuCount = await MenuModel.countDocuments();
        
        analytics.push({
          restaurantId: restaurant._id,
          name: restaurant.name,
          slug: restaurant.slug,
          isActive: restaurant.isActive,
          totalOrders,
          totalRevenue: totalRevenue[0]?.total || 0,
          menuCount
        });
      } catch (err) {
        analytics.push({
          restaurantId: restaurant._id,
          name: restaurant.name,
          slug: restaurant.slug,
          isActive: restaurant.isActive,
          totalOrders: 0,
          totalRevenue: 0,
          menuCount: 0
        });
      }
    }

    res.json({ analytics });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
};

const updateRestaurant = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug } = req.body;
    
    // Check if slug is being updated and if it already exists
    if (slug) {
      const existingRestaurant = await Restaurant.findOne({ 
        slug: slug.toLowerCase().trim(), 
        _id: { $ne: id } 
      });
      if (existingRestaurant) {
        return res.status(400).json({ error: 'Restaurant slug already exists. Please choose a different slug.' });
      }
    }
    
    const updateData = {};
    if (name) updateData.name = name;
    if (slug) updateData.slug = slug.toLowerCase().trim();
    
    const restaurant = await Restaurant.findByIdAndUpdate(
      id, 
      updateData, 
      { new: true }
    );
    
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    res.json({ message: 'Restaurant updated successfully', restaurant });
  } catch (error) {
    console.error('Update restaurant error:', error);
    res.status(500).json({ error: 'Failed to update restaurant' });
  }
};

const deleteRestaurant = async (req, res) => {
  try {
    const { id } = req.params;
    
    const restaurant = await Restaurant.findByIdAndDelete(id);
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    res.json({ message: 'Restaurant deleted successfully' });
  } catch (error) {
    console.error('Delete restaurant error:', error);
    res.status(500).json({ error: 'Failed to delete restaurant' });
  }
};

const toggleRestaurantStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const restaurant = await Restaurant.findById(id);
    
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    restaurant.isActive = !restaurant.isActive;
    await restaurant.save();

    res.json({
      message: `Restaurant ${restaurant.isActive ? 'enabled' : 'disabled'} successfully`,
      restaurant: {
        id: restaurant._id,
        name: restaurant.name,
        slug: restaurant.slug,
        isActive: restaurant.isActive
      }
    });
  } catch (error) {
    console.error('Toggle restaurant status error:', error);
    res.status(500).json({ error: 'Failed to update restaurant status' });
  }
};

module.exports = {
  createRestaurant,
  getRestaurants,
  getRestaurantAnalytics,
  updateRestaurant,
  deleteRestaurant,
  toggleRestaurantStatus
};