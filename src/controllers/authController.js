const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');
const SuperAdmin = require('../models/SuperAdmin');
const Restaurant = require('../models/Restaurant');
const TenantModelFactory = require('../models/TenantModelFactory');
const { generateToken } = require('../utils/jwt');

const registerSuperAdmin = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, name } = req.body;

    const existingSuperAdmin = await SuperAdmin.findOne({ email });
    if (existingSuperAdmin) {
      return res.status(400).json({ error: 'Super admin already exists with this email' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const superAdmin = new SuperAdmin({
      email,
      password: hashedPassword,
      name,
      role: 'SUPER_ADMIN'
    });

    await superAdmin.save();

    const token = generateToken({
      userId: superAdmin._id,
      role: superAdmin.role
    });

    res.status(201).json({
      message: 'Super admin registered successfully',
      token,
      user: {
        id: superAdmin._id,
        email: superAdmin.email,
        name: superAdmin.name,
        role: superAdmin.role
      }
    });
  } catch (error) {
    console.error('Super admin registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
};

const login = async (req, res) => {
  try {
    const { email, password, restaurantSlug } = req.body;

    // Super Admin Login (no slug required) — branch immediately
    if (!restaurantSlug) {
      const superAdmin = await SuperAdmin.findOne({ email, isActive: true });
      if (!superAdmin || !await bcrypt.compare(password, superAdmin.password)) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      const token = generateToken({ userId: superAdmin._id, role: superAdmin.role });
      return res.json({ token, user: { id: superAdmin._id, email: superAdmin.email, name: superAdmin.name, role: superAdmin.role } });
    }

    // Restaurant Admin Login
    const [restaurant, StaffModel] = await Promise.all([
      Restaurant.findOne({ slug: restaurantSlug, email, isActive: true }),
      Promise.resolve(TenantModelFactory.getStaffModel(restaurantSlug))
    ]);
    
    if (restaurant && await bcrypt.compare(password, restaurant.password)) {
      const token = generateToken({ userId: restaurant._id, role: 'RESTAURANT_ADMIN', restaurantSlug });
      return res.json({ token, user: { id: restaurant._id, email: restaurant.email, name: restaurant.ownerName, role: 'RESTAURANT_ADMIN', restaurantSlug } });
    }

    // Staff Login
    const staff = await StaffModel.findOne({ email, isActive: true });
    if (!staff || !await bcrypt.compare(password, staff.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = generateToken({ userId: staff._id, role: staff.role, restaurantSlug });
    res.json({ token, user: { id: staff._id, email: staff.email, name: staff.name, role: staff.role, restaurantSlug } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

module.exports = {
  registerSuperAdmin,
  login
};
