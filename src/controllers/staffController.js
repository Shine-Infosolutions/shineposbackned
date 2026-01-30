const bcrypt = require('bcryptjs');
const TenantModelFactory = require('../models/TenantModelFactory');

const createStaff = async (req, res) => {
  try {
    const { email, password, name, role, permissions, phone, hourlyRate, overtimeRate, shiftSchedule } = req.body;
    const restaurantSlug = req.user.restaurantSlug;
    
    console.log('=== CREATE STAFF DEBUG ===');
    console.log('Request body:', req.body);
    console.log('Extracted shiftSchedule:', shiftSchedule);
    
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
    
    const staffData = {
      email,
      password: hashedPassword,
      name,
      role,
      permissions: permissions || [],
      phone,
      hourlyRate: hourlyRate || 0,
      overtimeRate: overtimeRate || 0,
      shiftSchedule: shiftSchedule || {
        shiftType: 'fixed',
        fixedShift: {
          startTime: '09:00',
          endTime: '17:00',
          workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
        }
      }
    };
    
    console.log('Staff data to save:', JSON.stringify(staffData, null, 2));
    
    const staff = new StaffModel(staffData);
    await staff.save();
    
    // Force save shiftSchedule using MongoDB collection directly
    if (staffData.shiftSchedule) {
      await StaffModel.collection.updateOne(
        { _id: staff._id },
        { $set: { shiftSchedule: staffData.shiftSchedule } }
      );
    }
    
    const finalStaff = await StaffModel.findById(staff._id);
    
    console.log('Saved staff (full):', JSON.stringify(staff.toObject(), null, 2));
    
    const { password: _, ...responseData } = staff.toObject();
    res.status(201).json({ message: 'Staff member created successfully', staff: responseData });
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
    console.log('=== GET STAFF DEBUG ===');
    console.log('Staff with shifts:', staff.map(s => ({ name: s.name, shiftSchedule: s.shiftSchedule })));
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
    
    console.log('=== UPDATE STAFF DEBUG ===');
    console.log('Request body:', req.body);
    console.log('Staff ID:', id);
    
    const staff = await StaffModel.findById(id);
    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }
    
    const updateData = { ...req.body };
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }
    
    console.log('Update data:', updateData);
    console.log('Before update - staff shiftSchedule:', staff.shiftSchedule);
    
    Object.assign(staff, updateData);
    await staff.save();
    
    // Force save shiftSchedule using MongoDB collection directly
    if (updateData.shiftSchedule) {
      await StaffModel.collection.updateOne(
        { _id: staff._id },
        { $set: { shiftSchedule: updateData.shiftSchedule } }
      );
    }
    
    const finalStaff = await StaffModel.findById(staff._id);
    
    console.log('After update - staff shiftSchedule:', finalStaff.shiftSchedule);
    console.log('Updated staff:', finalStaff.toObject());
    
    const { password: _, ...staffData } = finalStaff.toObject();
    res.json({ message: 'Staff member updated successfully', staff: staffData });
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
    
    const staff = await StaffModel.findById(id);
    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }
    
    staff.performance = {
      ordersProcessed,
      averageOrderTime,
      customerRating
    };
    await staff.save();
    
    const { password: _, ...staffData } = staff.toObject();
    res.json({ message: 'Performance updated successfully', staff: staffData });
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