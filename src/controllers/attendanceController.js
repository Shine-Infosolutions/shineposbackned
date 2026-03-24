const TenantModelFactory = require('../models/TenantModelFactory');
const AttendanceUtils = require('../utils/attendanceUtils');

const checkIn = async (req, res) => {
  try {
    const { id } = req.params;
    const { location } = req.body;
    const restaurantSlug = req.user.restaurantSlug;
    const currentUserId = req.user.userId || req.user.id;
    
    // Prevent RESTAURANT_ADMIN from checking in for themselves
    if (req.user.role === 'RESTAURANT_ADMIN' && id === currentUserId) {
      return res.status(403).json({ error: 'Admins do not need to mark attendance' });
    }
    
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
    
    // Check for existing attendance today (single query covers both checks)
    let attendance = await AttendanceModel.findOne({ staffId: id, date: today });
    if (attendance?.checkIn) {
      return res.status(400).json({ error: 'Already checked in today' });
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
    
    const statusResult = AttendanceUtils.determineStatus(
      checkInTime, 
      null, 
      scheduledShift?.scheduledStart,
      staff.workingHours?.standardHours || 8
    );
    
    attendance.status = statusResult.status;
    attendance.lateMinutes = statusResult.lateMinutes;
    
    await attendance.save();
    res.json({ 
      message: 'Checked in successfully', 
      checkInTime, 
      status: attendance.status,
      lateMinutes: attendance.lateMinutes
    });
  } catch (error) {
    console.error('Check-in error:', error);
    res.status(500).json({ error: 'Check-in failed', details: error.message });
  }
};

const checkOut = async (req, res) => {
  try {
    const { id } = req.params;
    const { requestEarlyLeave } = req.body;
    const restaurantSlug = req.user.restaurantSlug;
    const currentUserId = req.user.userId || req.user.id;
    
    // Prevent RESTAURANT_ADMIN from checking out for themselves
    if (req.user.role === 'RESTAURANT_ADMIN' && id === currentUserId) {
      return res.status(403).json({ error: 'Admins do not need to mark attendance' });
    }
    
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
    const scheduledShift = AttendanceUtils.getScheduledShift(staff, today);
    const standardHours = staff?.workingHours?.standardHours || 8;
    
    // Check early leave eligibility if staff was late
    const earlyLeaveEligibility = AttendanceUtils.calculateEarlyLeaveEligibility(
      attendance.lateMinutes, 
      standardHours
    );
    
    // Handle early leave request
    if (requestEarlyLeave && earlyLeaveEligibility.isEligible) {
      attendance.earlyLeave = {
        isAllowed: true,
        reason: earlyLeaveEligibility.reason,
        approvedBy: currentUserId,
        approvedAt: new Date()
      };
    }
    
    attendance.checkOut = checkOutTime;
    attendance.workingHours = AttendanceUtils.calculateWorkingHours(attendance.checkIn, checkOutTime);
    
    const statusResult = AttendanceUtils.determineStatus(
      attendance.checkIn, 
      checkOutTime, 
      scheduledShift?.scheduledStart,
      standardHours
    );
    
    attendance.status = statusResult.status;
    attendance.lateMinutes = statusResult.lateMinutes;
    
    await attendance.save();
    
    const response = { 
      message: 'Checked out successfully', 
      checkOutTime,
      workingHours: attendance.workingHours
    };
    
    if (earlyLeaveEligibility.isEligible) {
      response.earlyLeaveEligibility = earlyLeaveEligibility;
      if (requestEarlyLeave) {
        response.message += ' with early leave approved';
      }
    }
    
    res.json(response);
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
    
    const expectedShifts = await generateExpectedShiftsWithHolidays(staff, startDate, endDate, restaurantSlug);
    
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
          expectedHours: expectedShift.expectedHours,
          isHoliday: expectedShift.isHoliday,
          holidayName: expectedShift.holidayName,
          isPaidHoliday: expectedShift.isPaidHoliday
        },
        actual: actualAttendance ? {
          checkIn: actualAttendance.checkIn,
          checkOut: actualAttendance.checkOut,
          status: actualAttendance.status,
          workingHours: actualAttendance.workingHours,
          holidayInfo: actualAttendance.holidayInfo
        } : {
          status: expectedShift.isHoliday && expectedShift.isPaidHoliday ? 'on-leave' : 'absent',
          workingHours: 0,
          holidayInfo: expectedShift.isHoliday ? {
            isHoliday: true,
            holidayName: expectedShift.holidayName,
            isPaid: expectedShift.isPaidHoliday
          } : null
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
            workingHours: record.workingHours,
            holidayInfo: record.holidayInfo
          }
        });
      }
    });
    
    const paidHolidaysCount = attendanceWithShifts.filter(a => 
      a.actual?.holidayInfo?.isPaid || a.expectedShift?.isPaidHoliday
    ).length;
    
    const summary = {
      totalScheduledDays: expectedShifts.length,
      presentDays: attendance.filter(a => a.status === 'present').length,
      lateDays: attendance.filter(a => a.status === 'late').length,
      onLeaveDays: attendance.filter(a => a.status === 'on-leave').length,
      paidHolidays: paidHolidaysCount,
      totalWorkedHours: attendance.reduce((sum, a) => sum + (a.workingHours || 0), 0),
      attendanceRate: expectedShifts.length > 0 ? ((attendance.filter(a => a.checkIn).length / expectedShifts.length) * 100).toFixed(1) : '0'
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
    console.error('Get my attendance error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
};

const getTodayAttendance = async (req, res) => {
  try {
    const restaurantSlug = req.user.restaurantSlug;
    const AttendanceModel = TenantModelFactory.getAttendanceModel(restaurantSlug);
    const StaffModel = TenantModelFactory.getStaffModel(restaurantSlug);
    
    const today = AttendanceUtils.getCurrentDate();
    const [attendance, allStaff] = await Promise.all([
      AttendanceModel.find({ date: today }).sort({ checkIn: -1 }).lean(),
      StaffModel.find({ isActive: true }).select('name role').lean()
    ]);

    // In-memory join — cross-connection populate silently returns null
    const staffMap = new Map(allStaff.map(s => [s._id.toString(), s]));
    const attendanceWithStaff = attendance.map(a => ({
      ...a,
      staffId: staffMap.get(a.staffId?.toString()) || a.staffId
    }));

    const presentStaffIds = new Set(attendance.map(a => a.staffId?.toString()));
    const absentStaff = allStaff.filter(s => !presentStaffIds.has(s._id.toString()));
    const onLeaveStaff = attendanceWithStaff.filter(a => a.status === 'on-leave');

    res.json({
      present: attendanceWithStaff.filter(a => a.checkIn && a.status !== 'on-leave'),
      absent: absentStaff,
      onLeave: onLeaveStaff,
      summary: {
        total: allStaff.length,
        present: attendanceWithStaff.filter(a => a.checkIn && a.status !== 'on-leave').length,
        absent: absentStaff.length,
        onLeave: onLeaveStaff.length,
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
    
    // Check if date is a predefined holiday
    const holidayCheck = await AttendanceUtils.checkHolidayForDate(targetDate, restaurantSlug, TenantModelFactory);
    
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
      // If it's a paid holiday and staff is absent, mark as present with holiday status
      if (holidayCheck.isHoliday && holidayCheck.isPaidHoliday && status === 'absent') {
        attendance.status = 'on-leave'; // Special status for paid holidays
        attendance.holidayInfo = {
          isHoliday: true,
          holidayName: holidayCheck.holiday.name,
          isPaid: true
        };
      } else {
        attendance.status = status;
      }
      
      if (checkIn) attendance.checkIn = new Date(checkIn);
      if (checkOut) attendance.checkOut = new Date(checkOut);
      attendance.modifiedBy = currentUserId;
    } else {
      let finalStatus = status;
      let holidayInfo = null;
      
      // If it's a paid holiday and marking as absent, treat as paid leave
      if (holidayCheck.isHoliday && holidayCheck.isPaidHoliday && status === 'absent') {
        finalStatus = 'on-leave';
        holidayInfo = {
          isHoliday: true,
          holidayName: holidayCheck.holiday.name,
          isPaid: true
        };
      }
      
      attendance = new AttendanceModel({
        staffId: id,
        date: targetDate,
        status: finalStatus,
        checkIn: checkIn ? new Date(checkIn) : null,
        checkOut: checkOut ? new Date(checkOut) : null,
        modifiedBy: currentUserId,
        holidayInfo
      });
    }
    
    if (attendance.checkIn && attendance.checkOut) {
      attendance.workingHours = AttendanceUtils.calculateWorkingHours(attendance.checkIn, attendance.checkOut);
    }
    
    await attendance.save();
    
    const response = { 
      message: 'Attendance marked successfully',
      holidayInfo: holidayCheck.isHoliday ? {
        isHoliday: true,
        holidayName: holidayCheck.holiday.name,
        isPaidHoliday: holidayCheck.isPaidHoliday,
        salaryDeduction: !holidayCheck.isPaidHoliday
      } : null
    };
    
    res.json(response);
  } catch (error) {
    console.error('Mark attendance error:', error);
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

const generateExpectedShiftsWithHolidays = async (staff, startDate, endDate, restaurantSlug) => {
  const shifts = [];
  const current = new Date(startDate);
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  
  const HolidayModel = TenantModelFactory.getHolidayModel(restaurantSlug);
  
  // Get all holidays in the date range
  const holidays = await HolidayModel.find({
    date: { $gte: startDate, $lte: endDate },
    isActive: true
  });
  
  const holidayMap = new Map();
  holidays.forEach(holiday => {
    const dateKey = new Date(holiday.date).toDateString();
    holidayMap.set(dateKey, holiday);
  });
  
  while (current <= endDate) {
    const dayName = dayNames[current.getDay()];
    const dateKey = current.toDateString();
    const holiday = holidayMap.get(dateKey);
    
    if (staff.shiftSchedule?.type === 'fixed' && staff.shiftSchedule.fixedShift) {
      const { startTime, endTime, workingDays } = staff.shiftSchedule.fixedShift;
      
      if (workingDays.includes(dayName) || holiday) {
        const startHour = parseInt(startTime.split(':')[0]);
        const startMinute = parseInt(startTime.split(':')[1]);
        const endHour = parseInt(endTime.split(':')[0]);
        const endMinute = parseInt(endTime.split(':')[1]);
        
        const expectedHours = (endHour + endMinute/60) - (startHour + startMinute/60);
        
        shifts.push({
          date: new Date(current),
          startTime: holiday ? null : startTime,
          endTime: holiday ? null : endTime,
          expectedHours: holiday && holiday.isPaid ? expectedHours : (holiday ? 0 : expectedHours),
          isHoliday: !!holiday,
          holidayName: holiday?.name,
          isPaidHoliday: holiday?.isPaid || false
        });
      }
    }
    
    current.setDate(current.getDate() + 1);
  }
  
  return shifts;
};

const getStaffAttendanceByDate = async (req, res) => {
  try {
    const { staffId } = req.params;
    const { date } = req.query;
    const restaurantSlug = req.user.restaurantSlug;
    const AttendanceModel = TenantModelFactory.getAttendanceModel(restaurantSlug);
    
    if (!date) {
      return res.status(400).json({ error: 'Date parameter required' });
    }
    
    const attendanceDate = new Date(date);
    attendanceDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(attendanceDate);
    nextDay.setDate(nextDay.getDate() + 1);
    
    const attendance = await AttendanceModel.findOne({
      staffId,
      date: { $gte: attendanceDate, $lt: nextDay }
    });
    
    res.json({ attendance });
  } catch (error) {
    console.error('Get staff attendance by date error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
};

const checkEarlyLeaveEligibility = async (req, res) => {
  try {
    const { id } = req.params;
    const restaurantSlug = req.user.restaurantSlug;
    const AttendanceModel = TenantModelFactory.getAttendanceModel(restaurantSlug);
    const StaffModel = TenantModelFactory.getStaffModel(restaurantSlug);
    const today = AttendanceUtils.getCurrentDate();
    
    const attendance = await AttendanceModel.findOne({ staffId: id, date: today });
    const staff = await StaffModel.findById(id);
    
    if (!attendance?.checkIn) {
      return res.status(400).json({ error: 'Staff has not checked in today' });
    }
    
    if (attendance.checkOut) {
      return res.status(400).json({ error: 'Staff has already checked out' });
    }
    
    const standardHours = staff?.workingHours?.standardHours || 8;
    const earlyLeaveEligibility = AttendanceUtils.calculateEarlyLeaveEligibility(
      attendance.lateMinutes, 
      standardHours
    );
    
    res.json({
      staffName: staff.name,
      checkInTime: attendance.checkIn,
      lateMinutes: attendance.lateMinutes,
      earlyLeaveEligibility,
      currentEarlyLeave: attendance.earlyLeave
    });
  } catch (error) {
    console.error('Check early leave eligibility error:', error);
    res.status(500).json({ error: 'Failed to check early leave eligibility' });
  }
};

const approveEarlyLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const restaurantSlug = req.user.restaurantSlug;
    const currentUserId = req.user.userId || req.user.id;
    const AttendanceModel = TenantModelFactory.getAttendanceModel(restaurantSlug);
    const StaffModel = TenantModelFactory.getStaffModel(restaurantSlug);
    const today = AttendanceUtils.getCurrentDate();
    
    if (!['RESTAURANT_ADMIN', 'MANAGER'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only admins and managers can approve early leave' });
    }
    
    const attendance = await AttendanceModel.findOne({ staffId: id, date: today });
    const staff = await StaffModel.findById(id);
    
    if (!attendance?.checkIn) {
      return res.status(400).json({ error: 'Staff has not checked in today' });
    }
    
    if (attendance.checkOut) {
      return res.status(400).json({ error: 'Staff has already checked out' });
    }
    
    const standardHours = staff?.workingHours?.standardHours || 8;
    const earlyLeaveEligibility = AttendanceUtils.calculateEarlyLeaveEligibility(
      attendance.lateMinutes, 
      standardHours
    );
    
    if (!earlyLeaveEligibility.isEligible) {
      return res.status(400).json({ error: 'Staff is not eligible for early leave' });
    }
    
    attendance.earlyLeave = {
      isAllowed: true,
      reason: reason || earlyLeaveEligibility.reason,
      approvedBy: currentUserId,
      approvedAt: new Date()
    };
    
    await attendance.save();
    
    res.json({
      message: 'Early leave approved successfully',
      staffName: staff.name,
      earlyLeaveDetails: attendance.earlyLeave,
      eligibility: earlyLeaveEligibility
    });
  } catch (error) {
    console.error('Approve early leave error:', error);
    res.status(500).json({ error: 'Failed to approve early leave' });
  }
};

module.exports = {
  checkIn,
  checkOut,
  getMyAttendance,
  getTodayAttendance,
  markAttendance,
  getAllAttendance,
  getStaffAttendanceByDate,
  checkEarlyLeaveEligibility,
  approveEarlyLeave
};