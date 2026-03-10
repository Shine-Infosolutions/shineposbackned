const bcrypt = require('bcryptjs');
const TenantModelFactory = require('../models/TenantModelFactory');

const createStaff = async (req, res) => {
  try {
    const { email, password, name, role, permissions, phone, salaryType, salaryAmount, hourlyRate, dayRate, overtimeRate, shiftSchedule } = req.body;
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
    
    const staffData = {
      email,
      password: hashedPassword,
      name,
      role,
      permissions: permissions || [],
      phone,
      salaryType: salaryType || 'fixed',
      salaryAmount: salaryAmount || 0,
      hourlyRate: hourlyRate || 0,
      dayRate: dayRate || 0,
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
    
    const staff = await StaffModel.find({ isActive: true })
      .select('-password')
      .sort({ createdAt: -1 })
      .lean();
    
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
    
    
    
    
    
    const staff = await StaffModel.findById(id);
    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }
    
    const updateData = { ...req.body };
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }
    
    
    
    
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

const assignOvertime = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, startTime, endTime, hours, reason } = req.body;
    const restaurantSlug = req.user.restaurantSlug;
    const currentUserId = req.user.userId || req.user.id;
    const StaffModel = TenantModelFactory.getStaffModel(restaurantSlug);
    const OvertimeModel = TenantModelFactory.getOvertimeModel(restaurantSlug);
    
    const staff = await StaffModel.findById(id);
    if (!staff) {
      return res.status(400).json({ error: 'Staff member not found' });
    }

    const rate = staff.overtimeRate || 0;
    const amount = hours * rate;

    const overtime = new OvertimeModel({
      staffId: id,
      staffName: staff.name,
      date,
      startTime,
      endTime,
      hours,
      rate,
      amount,
      reason,
      status: 'pending',
      assignedBy: currentUserId
    });
    await overtime.save();

    res.json({ message: 'Overtime assigned successfully', overtime });
  } catch (error) {
    console.error('Assign overtime error:', error);
    res.status(500).json({ error: 'Failed to assign overtime' });
  }
};

const respondToOvertime = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status } = req.body;
    const restaurantSlug = req.user.restaurantSlug;
    const currentUserId = req.user.userId;
    const OvertimeModel = TenantModelFactory.getOvertimeModel(restaurantSlug);
    
    if (!['accepted', 'declined'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const overtime = await OvertimeModel.findById(requestId);
    if (!overtime) {
      return res.status(404).json({ error: 'Overtime request not found' });
    }
    
    if (overtime.staffId.toString() !== currentUserId.toString()) {
      return res.status(403).json({ error: 'Can only respond to your own overtime requests' });
    }
    
    if (overtime.status === 'completed' || overtime.status === 'declined') {
      return res.status(400).json({ error: 'Cannot change status of completed or declined overtime' });
    }
    
    if (overtime.status !== 'pending' && status === 'declined') {
      overtime.status = 'declined';
      overtime.respondedAt = new Date();
      await overtime.save();
      return res.json({ message: 'Overtime declined successfully', overtime });
    }
    
    if (overtime.status !== 'pending') {
      return res.status(400).json({ error: 'Overtime request already responded' });
    }
    
    overtime.status = status;
    overtime.respondedAt = new Date();
    await overtime.save();

    res.json({ message: `Overtime ${status} successfully`, overtime });
  } catch (error) {
    console.error('Respond to overtime error:', error);
    res.status(500).json({ error: 'Failed to respond to overtime' });
  }
};

const getMyOvertimeRequests = async (req, res) => {
  try {
    const restaurantSlug = req.user.restaurantSlug;
    const currentUserId = req.user.userId;
    const userRole = req.user.role;
    const OvertimeModel = TenantModelFactory.getOvertimeModel(restaurantSlug);
    
    let overtimeRequests;
    if (userRole === 'RESTAURANT_ADMIN') {
      overtimeRequests = await OvertimeModel.find().sort({ createdAt: -1 });
      return res.json({ 
        overtimeRequests,
        overtimeRate: 0,
        salaryType: 'fixed',
        salaryAmount: 0,
        hourlyRate: 0,
        dayRate: 0
      });
    }
    
    const StaffModel = TenantModelFactory.getStaffModel(restaurantSlug);
    const staff = await StaffModel.findById(currentUserId).select('overtimeRate salaryType salaryAmount hourlyRate dayRate');
    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    overtimeRequests = await OvertimeModel.find({ staffId: currentUserId }).sort({ createdAt: -1 });

    res.json({ 
      overtimeRequests,
      overtimeRate: staff.overtimeRate || 0,
      salaryType: staff.salaryType,
      salaryAmount: staff.salaryAmount,
      hourlyRate: staff.hourlyRate,
      dayRate: staff.dayRate
    });
  } catch (error) {
    console.error('Get overtime requests error:', error);
    res.status(500).json({ error: 'Failed to fetch overtime requests' });
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

const setOvertimeRate = async (req, res) => {
  try {
    const { id } = req.params;
    const { overtimeRate } = req.body;
    const restaurantSlug = req.user.restaurantSlug;
    const StaffModel = TenantModelFactory.getStaffModel(restaurantSlug);
    
    console.log('Setting overtime rate:', { id, overtimeRate: Number(overtimeRate), restaurantSlug });
    
    const staff = await StaffModel.findById(id);
    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }
    
    staff.overtimeRate = Number(overtimeRate) || 0;
    await staff.save();
    
    console.log('Updated staff overtime rate:', staff.overtimeRate);
    
    const { password: _, ...staffData } = staff.toObject();
    res.json({ message: 'Overtime rate updated successfully', staff: staffData });
  } catch (error) {
    console.error('Set overtime rate error:', error);
    res.status(500).json({ error: 'Failed to set overtime rate', details: error.message });
  }
};

const addOvertimeRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, startTime, endTime, hours, notes } = req.body;
    const restaurantSlug = req.user.restaurantSlug;
    const currentUserId = req.user.userId || req.user.id;
    const StaffModel = TenantModelFactory.getStaffModel(restaurantSlug);
    
    const staff = await StaffModel.findById(id);
    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }
    
    if (!staff.overtimeRecords) {
      staff.overtimeRecords = [];
    }
    
    const overtimeHours = Number(hours) || 0;
    const amount = overtimeHours * (staff.overtimeRate || 0);
    
    staff.overtimeRecords.push({
      date: date || new Date(),
      startTime,
      endTime,
      hours: overtimeHours,
      rate: staff.overtimeRate,
      amount,
      notes,
      createdBy: currentUserId
    });
    
    await staff.save();
    
    res.json({ 
      message: 'Overtime record added successfully', 
      record: staff.overtimeRecords[staff.overtimeRecords.length - 1] 
    });
  } catch (error) {
    console.error('Add overtime record error:', error);
    console.error('Error details:', error.message);
    res.status(500).json({ error: 'Failed to add overtime record', details: error.message });
  }
};

const getOvertimeRecords = async (req, res) => {
  try {
    const { id } = req.params;
    const restaurantSlug = req.user.restaurantSlug;
    const StaffModel = TenantModelFactory.getStaffModel(restaurantSlug);
    
    const staff = await StaffModel.findById(id).select('name overtimeRecords overtimeRate');
    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }
    
    res.json({ overtimeRecords: staff.overtimeRecords || [], staff: { name: staff.name, overtimeRate: staff.overtimeRate } });
  } catch (error) {
    console.error('Get overtime records error:', error);
    res.status(500).json({ error: 'Failed to fetch overtime records' });
  }
};

const completeOvertime = async (req, res) => {
  try {
    const { requestId } = req.params;
    const restaurantSlug = req.user.restaurantSlug;
    const OvertimeModel = TenantModelFactory.getOvertimeModel(restaurantSlug);
    
    const overtime = await OvertimeModel.findByIdAndUpdate(
      requestId,
      { status: 'completed', completedAt: new Date() },
      { new: true }
    );
    
    if (!overtime) {
      return res.status(404).json({ error: 'Overtime record not found' });
    }

    res.json({ message: 'Overtime marked as completed', overtime });
  } catch (error) {
    console.error('Complete overtime error:', error);
    res.status(500).json({ error: 'Failed to complete overtime' });
  }
};

const getStaffOvertimeRecords = async (req, res) => {
  try {
    const { staffId } = req.params;
    const restaurantSlug = req.user.restaurantSlug;
    const OvertimeModel = TenantModelFactory.getOvertimeModel(restaurantSlug);
    
    const records = await OvertimeModel.find({ staffId }).sort({ createdAt: -1 });
    
    res.json({ records });
  } catch (error) {
    console.error('Get staff overtime records error:', error);
    res.status(500).json({ error: 'Failed to fetch overtime records' });
  }
};

const getOvertimeResponses = async (req, res) => {
  try {
    const restaurantSlug = req.user.restaurantSlug;
    const OvertimeModel = TenantModelFactory.getOvertimeModel(restaurantSlug);
    
    const responses = await OvertimeModel.find().sort({ createdAt: -1 });
    
    res.json({ responses });
  } catch (error) {
    console.error('Get overtime responses error:', error);
    res.status(500).json({ error: 'Failed to fetch overtime responses' });
  }
};

module.exports = {
  createStaff,
  getStaff,
  updateStaff,
  scheduleShift,
  updatePerformance,
  assignOvertime,
  respondToOvertime,
  getMyOvertimeRequests,
  setOvertimeRate,
  addOvertimeRecord,
  getOvertimeRecords,
  getOvertimeResponses,
  getStaffOvertimeRecords,
  completeOvertime
};
