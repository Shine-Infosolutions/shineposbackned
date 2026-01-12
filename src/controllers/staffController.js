const bcrypt = require('bcryptjs');
const TenantModelFactory = require('../models/TenantModelFactory');

const createStaff = async (req, res) => {
  try {
    const { email, password, name, role, permissions, phone, hourlyRate } = req.body;
    const restaurantSlug = req.user.restaurantSlug;
    
    if (!restaurantSlug) {
      return res.status(400).json({ error: 'Restaurant slug is required' });
    }
    
    const StaffModel = TenantModelFactory.getStaffModel(restaurantSlug);
    
    // Check if staff with email already exists
    const existingStaff = await StaffModel.findOne({ email });
    if (existingStaff) {
      return res.status(400).json({ error: 'Staff member with this email already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const staff = new StaffModel({
      email,
      password: hashedPassword,
      name,
      role,
      permissions: permissions || [],
      phone,
      hourlyRate: hourlyRate || 0
    });

    await staff.save();
    
    const { password: _, ...staffData } = staff.toObject();
    res.status(201).json({ message: 'Staff member created successfully', staff: staffData });
  } catch (error) {
    console.error('Create staff error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error message:', error.message);
    res.status(500).json({ error: 'Failed to create staff member', details: error.message });
  }
};

const getStaff = async (req, res) => {
  try {
    const restaurantSlug = req.user.restaurantSlug;
    const StaffModel = TenantModelFactory.getStaffModel(restaurantSlug);
    
    const staff = await StaffModel.find({ isActive: true }).select('-password').sort({ createdAt: -1 });
    res.json({ staff });
  } catch (error) {
    console.error('Get staff error:', error);
    res.status(500).json({ error: 'Failed to fetch staff' });
  }
};

const updateStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const restaurantSlug = req.user.restaurantSlug;
    const StaffModel = TenantModelFactory.getStaffModel(restaurantSlug);
    
    const updateData = { ...req.body };
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }
    
    const staff = await StaffModel.findByIdAndUpdate(id, updateData, { new: true }).select('-password');
    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    res.json({ message: 'Staff member updated successfully', staff });
  } catch (error) {
    console.error('Update staff error:', error);
    res.status(500).json({ error: 'Failed to update staff member' });
  }
};

const scheduleShift = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, startTime, endTime } = req.body;
    const restaurantSlug = req.user.restaurantSlug;
    const StaffModel = TenantModelFactory.getStaffModel(restaurantSlug);
    
    const staff = await StaffModel.findById(id);
    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    staff.shifts.push({ date, startTime, endTime });
    await staff.save();

    res.json({ message: 'Shift scheduled successfully', staff });
  } catch (error) {
    console.error('Schedule shift error:', error);
    res.status(500).json({ error: 'Failed to schedule shift' });
  }
};

const updatePerformance = async (req, res) => {
  try {
    const { id } = req.params;
    const { ordersProcessed, averageOrderTime, customerRating } = req.body;
    const restaurantSlug = req.user.restaurantSlug;
    const StaffModel = TenantModelFactory.getStaffModel(restaurantSlug);
    
    const staff = await StaffModel.findByIdAndUpdate(
      id,
      { 
        $set: {
          'performance.ordersProcessed': ordersProcessed,
          'performance.averageOrderTime': averageOrderTime,
          'performance.customerRating': customerRating
        }
      },
      { new: true }
    ).select('-password');

    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    res.json({ message: 'Performance updated successfully', staff });
  } catch (error) {
    console.error('Update performance error:', error);
    res.status(500).json({ error: 'Failed to update performance' });
  }
};

module.exports = {
  createStaff,
  getStaff,
  updateStaff,
  scheduleShift,
  updatePerformance
};