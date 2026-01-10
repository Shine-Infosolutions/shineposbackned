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

    // Check if super admin already exists
    const existingSuperAdmin = await SuperAdmin.findOne({ email });
    if (existingSuperAdmin) {
      return res.status(400).json({ error: 'Super admin already exists with this email' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create super admin
    const superAdmin = new SuperAdmin({
      email,
      password: hashedPassword,
      name,
      role: 'SUPER_ADMIN'
    });

    await superAdmin.save();

    // Generate token
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

    let user, role, tokenPayload;

    if (restaurantSlug) {
      // First try Restaurant admin login
      const restaurant = await Restaurant.findOne({ 
        slug: restaurantSlug, 
        email: email,
        isActive: true 
      });
      
      if (restaurant && await bcrypt.compare(password, restaurant.password)) {
        tokenPayload = {
          userId: restaurant._id,
          role: 'RESTAURANT_ADMIN',
          restaurantSlug: restaurantSlug
        };
        
        user = {
          _id: restaurant._id,
          email: restaurant.email,
          name: restaurant.ownerName
        };
      } else {
        // Try staff login in tenant database
        const StaffModel = TenantModelFactory.getStaffModel(restaurantSlug);
        const staff = await StaffModel.findOne({ email, isActive: true });
        
        if (staff && await bcrypt.compare(password, staff.password)) {
          tokenPayload = {
            userId: staff._id,
            role: staff.role,
            restaurantSlug: restaurantSlug
          };
          
          user = {
            _id: staff._id,
            email: staff.email,
            name: staff.name
          };
        } else {
          return res.status(401).json({ error: 'Invalid credentials' });
        }
      }
    } else {
      // Try Super admin login first
      user = await SuperAdmin.findOne({ email, isActive: true });
      
      if (user && await bcrypt.compare(password, user.password)) {
        tokenPayload = {
          userId: user._id,
          role: user.role
        };
      } else {
        // Try Restaurant login
        user = await Restaurant.findOne({ email, isActive: true });
        
        if (user && await bcrypt.compare(password, user.password)) {
          tokenPayload = {
            userId: user._id,
            role: 'RESTAURANT_ADMIN',
            restaurantSlug: user.slug
          };
        } else {
          // Try staff login across all restaurants
          const restaurants = await Restaurant.find({ isActive: true });
          let staffFound = false;
          
          for (const restaurant of restaurants) {
            try {
              const StaffModel = TenantModelFactory.getStaffModel(restaurant.slug);
              const staff = await StaffModel.findOne({ email, isActive: true });
              
              if (staff && await bcrypt.compare(password, staff.password)) {
                tokenPayload = {
                  userId: staff._id,
                  role: staff.role,
                  restaurantSlug: restaurant.slug
                };
                
                user = {
                  _id: staff._id,
                  email: staff.email,
                  name: staff.name
                };
                
                staffFound = true;
                break;
              }
            } catch (error) {
              continue;
            }
          }
          
          if (!staffFound) {
            return res.status(401).json({ error: 'Invalid credentials' });
          }
        }
      }
    }

    const token = generateToken(tokenPayload);

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: tokenPayload.role,
        restaurantSlug: tokenPayload.restaurantSlug || null
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

module.exports = {
  registerSuperAdmin,
  login
};
