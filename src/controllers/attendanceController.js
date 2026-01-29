const TenantModelFactory = require('../models/TenantModelFactory');
const AttendanceUtils = require('../utils/attendanceUtils');

const checkIn = async (req, res) => {
  try {
    const { id } = req.params;
    const { location } = req.body;
    const restaurantSlug = req.user.restaurantSlug;
    const currentUserId = req.user.userId || req.user.id;
    
    if (id !== currentUserId && !['RESTAURANT_ADMIN', 'MANAGER'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Can only check in for yourself' });
    }
    
    const StaffModel = TenantModelFactory.getStaffModel(restaurantSlug);
    const AttendanceModel = TenantModelFactory.getAttendanceModel(restaurantSlug);
    
    const staff = await StaffModel.findById(id);
    if (!staff) return res.status(404).json({ error: 'Staff not found' });
    
    const today = AttendanceUtils.getCurrentDate();
    const checkInTime = new Date();
    
    // Prevent future date check-ins
    const currentDate = AttendanceUtils.getCurrentDate();
    if (today > currentDate) {
      return res.status(400).json({ error: 'Cannot check in for future dates' });
    }
    
    // Check for existing attendance today
    let attendance = await AttendanceModel.findOne({ staffId: id, date: today });
    if (attendance?.checkIn) {
      return res.status(400).json({ error: 'Already checked in today' });
    }
    
    // Check for double shifts - prevent multiple check-ins same day
    const existingAttendanceToday = await AttendanceModel.countDocuments({
      staffId: id,
      date: today,
      checkIn: { $exists: true }
    });
    
    if (existingAttendanceToday > 0) {
      return res.status(400).json({ error: 'Multiple shifts same day not allowed' });
    }
    
    const scheduledShift = AttendanceUtils.getScheduledShift(staff, today);
    
    if (!attendance) {
      attendance = new AttendanceModel({
        staffId: id,
        date: today,
        checkIn: checkInTime,
        location,
        modifiedBy: currentUserId
      });
    } else {
      attendance.checkIn = checkInTime;
      attendance.location = location;
    }
    
    attendance.status = AttendanceUtils.determineStatus(
      checkInTime, 
      null, 
      scheduledShift?.scheduledStart,
      staff.workingHours?.standardHours || 8
    );
    
    await attendance.save();
    res.json({ message: 'Checked in successfully', checkInTime, status: attendance.status });
  } catch (error) {
    console.error('Check-in error:', error);
    res.status(500).json({ error: 'Check-in failed', details: error.message });
  }
};

const checkOut = async (req, res) => {
  try {
    const { id } = req.params;
    const restaurantSlug = req.user.restaurantSlug;
    const currentUserId = req.user.userId || req.user.id;
    
    if (id !== currentUserId && !['RESTAURANT_ADMIN', 'MANAGER'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Can only check out for yourself' });
    }
    
    const AttendanceModel = TenantModelFactory.getAttendanceModel(restaurantSlug);
    const StaffModel = TenantModelFactory.getStaffModel(restaurantSlug);
    const today = AttendanceUtils.getCurrentDate();
    
    const attendance = await AttendanceModel.findOne({ staffId: id, date: today });
    const staff = await StaffModel.findById(id);
    
    if (!attendance?.checkIn) {
      return res.status(400).json({ error: 'Must check in first' });
    }
    if (attendance.checkOut) {
      return res.status(400).json({ error: 'Already checked out' });
    }
    
    const checkOutTime = new Date();
    attendance.checkOut = checkOutTime;
    attendance.workingHours = AttendanceUtils.calculateWorkingHours(attendance.checkIn, checkOutTime);
    
    const scheduledShift = AttendanceUtils.getScheduledShift(staff, today);
    attendance.status = AttendanceUtils.determineStatus(
      attendance.checkIn, 
      checkOutTime, 
      scheduledShift?.scheduledStart,
      staff?.workingHours?.standardHours || 8
    );
    
    await attendance.save();
    res.json({ 
      message: 'Checked out successfully', 
      checkOutTime,
      workingHours: attendance.workingHours
    });
  } catch (error) {
    res.status(500).json({ error: 'Check-out failed' });
  }
};

const getMyAttendance = async (req, res) => {
  try {
    const staffId = req.user.userId || req.user.id;
    const { month, year } = req.query;
    const restaurantSlug = req.user.restaurantSlug;
    
    const AttendanceModel = TenantModelFactory.getAttendanceModel(restaurantSlug);
    const StaffModel = TenantModelFactory.getStaffModel(restaurantSlug);
    
    const staff = await StaffModel.findById(staffId);
    if (!staff) return res.status(404).json({ error: 'Staff not found' });
    
    const currentDate = new Date();
    const currentYear = year || currentDate.getFullYear();
    const currentMonth = month || (currentDate.getMonth() + 1);
    
    const startDate = new Date(currentYear, currentMonth - 1, 1);
    const endDate = new Date(currentYear, currentMonth, 0, 23, 59, 59);
    
    const attendance = await AttendanceModel.find({
      staffId,
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: -1 });
    
    const expectedShifts = generateExpectedShifts(staff, startDate, endDate);
    
    // Create a map of actual attendance by date
    const attendanceMap = new Map();
    attendance.forEach(record => {
      const dateKey = new Date(record.date).toDateString();
      attendanceMap.set(dateKey, record);
    });
    
    const attendanceWithShifts = expectedShifts.map(expectedShift => {
      const dateKey = new Date(expectedShift.date).toDateString();
      const actualAttendance = attendanceMap.get(dateKey);
      
      return {
        date: expectedShift.date,
        expectedShift: {
          startTime: expectedShift.startTime,
          endTime: expectedShift.endTime,
          expectedHours: expectedShift.expectedHours
        },
        actual: actualAttendance ? {
          checkIn: actualAttendance.checkIn,
          checkOut: actualAttendance.checkOut,
          status: actualAttendance.status,
          workingHours: actualAttendance.workingHours
        } : {
          status: 'absent',
          workingHours: 0
        }
      };
    });
    
    // Add any attendance records that don't have expected shifts
    attendance.forEach(record => {
      const dateKey = new Date(record.date).toDateString();
      const hasExpectedShift = expectedShifts.some(shift => 
        new Date(shift.date).toDateString() === dateKey
      );
      
      if (!hasExpectedShift) {
        attendanceWithShifts.push({
          date: record.date,
          expectedShift: null,
          actual: {
            checkIn: record.checkIn,
            checkOut: record.checkOut,
            status: record.status,
            workingHours: record.workingHours
          }
        });
      }
    });
    
    const summary = {
      totalScheduledDays: expectedShifts.length,
      presentDays: attendance.filter(a => a.status === 'present').length,
      lateDays: attendance.filter(a => a.status === 'late').length,
      totalWorkedHours: attendance.reduce((sum, a) => sum + (a.workingHours || 0), 0),
      attendanceRate: ((attendance.filter(a => a.checkIn).length / expectedShifts.length) * 100).toFixed(1)
    };
    
    res.json({
      staff: {
        name: staff.name,
        role: staff.role,
        shiftSchedule: staff.shiftSchedule
      },
      attendance: attendanceWithShifts,
      summary
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
};

const getTodayAttendance = async (req, res) => {
  try {
    const restaurantSlug = req.user.restaurantSlug;
    const AttendanceModel = TenantModelFactory.getAttendanceModel(restaurantSlug);
    const StaffModel = TenantModelFactory.getStaffModel(restaurantSlug);
    
    const today = AttendanceUtils.getCurrentDate();
    const attendance = await AttendanceModel.find({ date: today })
      .populate('staffId', 'name role')
      .sort({ checkIn: -1 });
    
    const allStaff = await StaffModel.find({ isActive: true }, 'name role');
    const presentStaffIds = attendance.map(a => a.staffId._id.toString());
    const absentStaff = allStaff.filter(staff => 
      !presentStaffIds.includes(staff._id.toString())
    );
    
    res.json({ 
      present: attendance,
      absent: absentStaff,
      summary: {
        total: allStaff.length,
        present: attendance.filter(a => a.checkIn).length,
        absent: absentStaff.length,
        checkedOut: attendance.filter(a => a.checkOut).length
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch today attendance' });
  }
};

const markAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, status, checkIn, checkOut } = req.body;
    const restaurantSlug = req.user.restaurantSlug;
    const currentUserId = req.user.userId || req.user.id;
    
    // Prevent future date marking (except for admins)
    const targetDate = AttendanceUtils.normalizeDate(date);
    const dateValidation = AttendanceUtils.validateAttendanceDate(targetDate);
    
    if (dateValidation.isFuture && !['RESTAURANT_ADMIN'].includes(req.user.role)) {
      return res.status(400).json({ error: 'Cannot mark attendance for future dates' });
    }
    
    // Validate check-in/out times
    const timeValidation = AttendanceUtils.validateCheckInOut(checkIn, checkOut);
    if (!timeValidation.isValid) {
      return res.status(400).json({ error: timeValidation.errors[0] });
    }
    
    const AttendanceModel = TenantModelFactory.getAttendanceModel(restaurantSlug);
    
    // Check for existing attendance to prevent double shifts
    const existingAttendance = await AttendanceModel.findOne({ staffId: id, date: targetDate });
    
    if (existingAttendance && existingAttendance.checkIn && checkIn) {
      return res.status(400).json({ error: 'Staff already has attendance record for this date' });
    }
    
    let attendance = existingAttendance;
    
    if (attendance) {
      attendance.status = status;
      if (checkIn) attendance.checkIn = new Date(checkIn);
      if (checkOut) attendance.checkOut = new Date(checkOut);
      attendance.modifiedBy = currentUserId;
    } else {
      attendance = new AttendanceModel({
        staffId: id,
        date: targetDate,
        status,
        checkIn: checkIn ? new Date(checkIn) : null,
        checkOut: checkOut ? new Date(checkOut) : null,
        modifiedBy: currentUserId
      });
    }
    
    if (attendance.checkIn && attendance.checkOut) {
      attendance.workingHours = AttendanceUtils.calculateWorkingHours(attendance.checkIn, attendance.checkOut);
    }
    
    await attendance.save();
    res.json({ message: 'Attendance marked successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark attendance' });
  }
};

const getAllAttendance = async (req, res) => {
  try {
    const { startDate, endDate, staffId, status } = req.query;
    const restaurantSlug = req.user.restaurantSlug;
    
    const AttendanceModel = TenantModelFactory.getAttendanceModel(restaurantSlug);
    
    let query = {};
    
    if (startDate && endDate) {
      query.date = {
        $gte: AttendanceUtils.normalizeDate(startDate),
        $lte: AttendanceUtils.normalizeDate(endDate)
      };
    }
    
    if (staffId) query.staffId = staffId;
    if (status) query.status = status;
    
    const attendance = await AttendanceModel.find(query)
      .populate('staffId', 'name role')
      .sort({ date: -1, checkIn: -1 });
    
    res.json({ attendance });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
};

const generateExpectedShifts = (staff, startDate, endDate) => {
  const shifts = [];
  const current = new Date(startDate);
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  
  while (current <= endDate) {
    const dayName = dayNames[current.getDay()];
    
    if (staff.shiftSchedule?.type === 'fixed' && staff.shiftSchedule.fixedShift) {
      const { startTime, endTime, workingDays } = staff.shiftSchedule.fixedShift;
      
      if (workingDays.includes(dayName)) {
        const startHour = parseInt(startTime.split(':')[0]);
        const startMinute = parseInt(startTime.split(':')[1]);
        const endHour = parseInt(endTime.split(':')[0]);
        const endMinute = parseInt(endTime.split(':')[1]);
        
        const expectedHours = (endHour + endMinute/60) - (startHour + startMinute/60);
        
        shifts.push({
          date: new Date(current),
          startTime,
          endTime,
          expectedHours
        });
      }
    }
    
    current.setDate(current.getDate() + 1);
  }
  
  return shifts;
};

module.exports = {
  checkIn,
  checkOut,
  getMyAttendance,
  getTodayAttendance,
  markAttendance,
  getAllAttendance
};