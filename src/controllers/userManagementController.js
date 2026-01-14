const bcrypt = require('bcryptjs');
const Restaurant = require('../models/Restaurant');
const TenantModelFactory = require('../models/TenantModelFactory');

const getAllUsers = async (req, res) => {
  try {
    const restaurants = await Restaurant.find();
    const allUsers = [];

    for (const restaurant of restaurants) {
      try {
        // Add restaurant admin from restaurant collection
        allUsers.push({
          _id: restaurant._id + '_admin',
          name: restaurant.ownerName,
          email: restaurant.email,
          role: 'RESTAURANT_ADMIN',
          isActive: restaurant.isActive,
          restaurantName: restaurant.restaurantName || restaurant.name,
          restaurantSlug: restaurant.slug,
          restaurantId: restaurant._id,
          createdAt: restaurant.createdAt
        });

        // Fetch from users collection
        const UserModel = TenantModelFactory.getUserModel(restaurant.slug);
        const users = await UserModel.find().select('-password');
        
        users.forEach(user => {
          allUsers.push({
            ...user.toObject(),
            restaurantName: restaurant.restaurantName || restaurant.name,
            restaurantSlug: restaurant.slug,
            restaurantId: restaurant._id
          });
        });

        // Also fetch from staff collection
        const StaffModel = TenantModelFactory.getStaffModel(restaurant.slug);
        const staff = await StaffModel.find().select('-password');
        
        staff.forEach(staffMember => {
          allUsers.push({
            ...staffMember.toObject(),
            restaurantName: restaurant.restaurantName || restaurant.name,
            restaurantSlug: restaurant.slug,
            restaurantId: restaurant._id
          });
        });
      } catch (error) {
        console.error(`Error fetching users for ${restaurant.slug}:`, error);
      }
    }

    res.json({ users: allUsers });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

const getRestaurantUsers = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const restaurant = await Restaurant.findById(restaurantId);
    
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    const UserModel = TenantModelFactory.getUserModel(restaurant.slug);
    const users = await UserModel.find().select('-password');
    
    res.json({ users });
  } catch (error) {
    console.error('Get restaurant users error:', error);
    res.status(500).json({ error: 'Failed to fetch restaurant users' });
  }
};

const createUser = async (req, res) => {
  try {
    const { restaurantId, email, password, name, role, permissions, shift } = req.body;
    
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    // Check if subscription is active (time-based)
    const TimeBasedSubscriptionService = require('../services/TimeBasedSubscriptionService');
    await TimeBasedSubscriptionService.checkSubscriptionStatus(restaurant.slug);

    // Check if user already exists
    const UserModel = TenantModelFactory.getUserModel(restaurant.slug);
    const existingUser = await UserModel.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Set default permissions based on role
    const defaultPermissions = {
      RESTAURANT_ADMIN: ['orders', 'menus', 'inventory', 'staff', 'reports', 'kitchen'],
      MANAGER: ['orders', 'menus', 'inventory', 'reports'],
      CHEF: ['orders', 'kitchen', 'inventory'],
      WAITER: ['orders'],
      CASHIER: ['orders']
    };

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new UserModel({
      email,
      password: hashedPassword,
      name,
      role,
      permissions: permissions || defaultPermissions[role] || [],
      shift: shift || 'MORNING'
    });

    await user.save();
    
    const userResponse = user.toObject();
    delete userResponse.password;
    
    res.status(201).json({ 
      message: 'User created successfully', 
      user: userResponse 
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: error.message || 'Failed to create user' });
  }
};

const updateUser = async (req, res) => {
  try {
    const { restaurantId, userId } = req.params;
    const { name, role, isActive, permissions, shift } = req.body;
    
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    // Try to find and update in users collection first
    const UserModel = TenantModelFactory.getUserModel(restaurant.slug);
    let user = await UserModel.findByIdAndUpdate(
      userId,
      { name, role, isActive, permissions, shift },
      { new: true }
    ).select('-password');

    // If not found in users, try staff collection
    if (!user) {
      const StaffModel = TenantModelFactory.getStaffModel(restaurant.slug);
      user = await StaffModel.findByIdAndUpdate(
        userId,
        { name, role, isActive, permissions, shift },
        { new: true }
      ).select('-password');
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User updated successfully', user });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { restaurantId, userId } = req.params;
    
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    // Try to delete from users collection first
    const UserModel = TenantModelFactory.getUserModel(restaurant.slug);
    let user = await UserModel.findByIdAndDelete(userId);

    // If not found in users, try staff collection
    if (!user) {
      const StaffModel = TenantModelFactory.getStaffModel(restaurant.slug);
      user = await StaffModel.findByIdAndDelete(userId);
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
};

module.exports = {
  getAllUsers,
  getRestaurantUsers,
  createUser,
  updateUser,
  deleteUser
};