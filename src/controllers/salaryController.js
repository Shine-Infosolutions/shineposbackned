const mongoose = require('mongoose');
const TenantModelFactory = require('../models/TenantModelFactory');

// ─── ADVANCE SALARY ───────────────────────────────────────────────

const holdAdvanceSalary = async (req, res) => {
  try {
    const { staffId } = req.params;
    const { amount, reason, notes } = req.body;
    const restaurantSlug = req.user.restaurantSlug;
    const currentUserId = req.user.userId || req.user.id;

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Valid advance salary amount is required' });
    }

    const StaffModel = TenantModelFactory.getStaffModel(restaurantSlug);
    const AdvanceSalaryModel = TenantModelFactory.getAdvanceSalaryModel(restaurantSlug);

    const staff = await StaffModel.findById(staffId);
    if (!staff) return res.status(404).json({ error: 'Staff member not found' });

    // Save record in dedicated collection
    const record = await AdvanceSalaryModel.create({
      staffId,
      staffName: staff.name,
      amount: Number(amount),
      reason: reason || '',
      notes: notes || '',
      status: 'held',
      heldAt: new Date(),
      heldBy: currentUserId
    });

    // Also update staff document for quick access
    staff.advanceSalary = {
      amount: Number(amount),
      reason: reason || '',
      isHeld: true,
      heldAt: new Date(),
      heldBy: currentUserId
    };
    await staff.save();

    res.status(201).json({ message: 'Advance salary held successfully', record });
  } catch (error) {
    console.error('Hold advance salary error:', error);
    res.status(500).json({ error: 'Failed to hold advance salary' });
  }
};

const releaseAdvanceSalary = async (req, res) => {
  try {
    const { recordId } = req.params;
    const restaurantSlug = req.user.restaurantSlug;
    const currentUserId = req.user.userId || req.user.id;

    const AdvanceSalaryModel = TenantModelFactory.getAdvanceSalaryModel(restaurantSlug);
    const StaffModel = TenantModelFactory.getStaffModel(restaurantSlug);

    const record = await AdvanceSalaryModel.findById(recordId);
    if (!record) return res.status(404).json({ error: 'Advance salary record not found' });
    if (record.status !== 'held') return res.status(400).json({ error: 'Record is not in held status' });

    record.status = 'released';
    record.releasedAt = new Date();
    record.releasedBy = currentUserId;
    await record.save();

    // Clear from staff document
    const staff = await StaffModel.findById(record.staffId);
    if (staff) {
      staff.advanceSalary = { amount: 0, reason: '', isHeld: false };
      await staff.save();
    }

    res.json({ message: 'Advance salary released', record });
  } catch (error) {
    console.error('Release advance salary error:', error);
    res.status(500).json({ error: 'Failed to release advance salary' });
  }
};

const deductAdvanceSalary = async (req, res) => {
  try {
    const { recordId } = req.params;
    const restaurantSlug = req.user.restaurantSlug;

    const AdvanceSalaryModel = TenantModelFactory.getAdvanceSalaryModel(restaurantSlug);
    const StaffModel = TenantModelFactory.getStaffModel(restaurantSlug);

    const record = await AdvanceSalaryModel.findById(recordId);
    if (!record) return res.status(404).json({ error: 'Advance salary record not found' });
    if (record.status !== 'held') return res.status(400).json({ error: 'Only held records can be deducted' });

    record.status = 'deducted';
    record.deductedAt = new Date();
    await record.save();

    const staff = await StaffModel.findById(record.staffId);
    if (staff) {
      staff.advanceSalary = { amount: 0, reason: '', isHeld: false };
      await staff.save();
    }

    res.json({ message: 'Advance salary marked as deducted', record });
  } catch (error) {
    console.error('Deduct advance salary error:', error);
    res.status(500).json({ error: 'Failed to deduct advance salary' });
  }
};

const getAdvanceSalaryRecords = async (req, res) => {
  try {
    const { staffId } = req.params;
    const restaurantSlug = req.user.restaurantSlug;
    const AdvanceSalaryModel = TenantModelFactory.getAdvanceSalaryModel(restaurantSlug);

    const query = staffId ? { staffId: new mongoose.Types.ObjectId(staffId) } : {};
    const records = await AdvanceSalaryModel.find(query).sort({ createdAt: -1 });

    res.json({ records });
  } catch (error) {
    console.error('Get advance salary records error:', error);
    res.status(500).json({ error: 'Failed to fetch advance salary records' });
  }
};

// ─── PF DEDUCTION ─────────────────────────────────────────────────

// Enable PF for a staff — auto saves 2.5% employee deduction
const setPFDeduction = async (req, res) => {
  try {
    const { staffId } = req.params;
    const { isEnabled, notes } = req.body;
    const restaurantSlug = req.user.restaurantSlug;
    const currentUserId = req.user.userId || req.user.id;

    const StaffModel = TenantModelFactory.getStaffModel(restaurantSlug);
    const PFDeductionModel = TenantModelFactory.getPFDeductionModel(restaurantSlug);

    const staff = await StaffModel.findById(staffId);
    if (!staff) return res.status(404).json({ error: 'Staff member not found' });

    const salaryAmount = staff.salaryAmount || staff.hourlyRate || staff.dayRate || 0;
    const employeeDeduction = (salaryAmount * 2.5) / 100;
    const employerDeduction = (salaryAmount * 2.5) / 100;
    const month = new Date().toISOString().slice(0, 7);
    const staffObjectId = new mongoose.Types.ObjectId(staffId);

    const record = await PFDeductionModel.findOneAndUpdate(
      { staffId: staffObjectId, month },
      {
        staffId: staffObjectId,
        staffName: staff.name,
        salaryAmount,
        employeePercentage: 2.5,
        employeeDeduction,
        employerPercentage: 2.5,
        employerDeduction,
        totalDeduction: employeeDeduction,
        isEnabled: Boolean(isEnabled),
        status: Boolean(isEnabled) ? 'active' : 'cancelled',
        setBy: currentUserId,
        notes: notes || ''
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    staff.pfDeduction = { percentage: 2.5, isEnabled: Boolean(isEnabled) };
    await staff.save();

    res.json({ message: 'PF deduction enabled. 2.5% auto-deducted.', record });
  } catch (error) {
    console.error('Set PF deduction error:', error);
    res.status(500).json({ error: 'Failed to set PF deduction' });
  }
};

// Manually deduct extra 2.5% employer contribution on button click
const deductEmployerPF = async (req, res) => {
  try {
    const { staffId } = req.params;
    const restaurantSlug = req.user.restaurantSlug;
    const PFDeductionModel = TenantModelFactory.getPFDeductionModel(restaurantSlug);

    const month = new Date().toISOString().slice(0, 7);
    const staffObjectId = new mongoose.Types.ObjectId(staffId);

    const record = await PFDeductionModel.findOne({ staffId: staffObjectId, month });

    if (!record) return res.status(404).json({ error: 'No PF record found for this month. Enable PF first.' });
    if (!record.isEnabled) return res.status(400).json({ error: 'PF is not enabled for this staff' });
    if (record.employerDeducted) return res.status(400).json({ error: 'Employer PF already deducted for this month' });

    record.employerDeducted = true;
    record.employerDeductedAt = new Date();
    record.totalDeduction = record.employeeDeduction + record.employerDeduction;
    record.status = 'deducted';
    await record.save();

    res.json({
      message: `Extra 2.5% employer PF deducted. Total PF this month: ₹${record.totalDeduction.toFixed(2)}`,
      record
    });
  } catch (error) {
    console.error('Deduct employer PF error:', error);
    res.status(500).json({ error: 'Failed to deduct employer PF' });
  }
};

const getPFDeductionRecords = async (req, res) => {
  try {
    const { staffId } = req.params;
    const restaurantSlug = req.user.restaurantSlug;
    const PFDeductionModel = TenantModelFactory.getPFDeductionModel(restaurantSlug);

    const query = staffId ? { staffId: new mongoose.Types.ObjectId(staffId) } : {};
    const records = await PFDeductionModel.find(query).sort({ createdAt: -1 });

    res.json({ records });
  } catch (error) {
    console.error('Get PF deduction records error:', error);
    res.status(500).json({ error: 'Failed to fetch PF deduction records' });
  }
};

const markPFDeducted = async (req, res) => {
  try {
    const { recordId } = req.params;
    const restaurantSlug = req.user.restaurantSlug;
    const PFDeductionModel = TenantModelFactory.getPFDeductionModel(restaurantSlug);

    const record = await PFDeductionModel.findById(recordId);
    if (!record) return res.status(404).json({ error: 'PF record not found' });

    record.status = 'deducted';
    record.deductedAt = new Date();
    await record.save();

    res.json({ message: 'PF marked as deducted', record });
  } catch (error) {
    console.error('Mark PF deducted error:', error);
    res.status(500).json({ error: 'Failed to mark PF as deducted' });
  }
};

// ─── SALARY CALCULATION WITH AUTO ADVANCE DEDUCTION ──────────────

const calculateMonthlySalary = async (req, res) => {
  try {
    const { staffId } = req.params;
    const { month, year } = req.query;
    const restaurantSlug = req.user.restaurantSlug;
    
    const currentDate = new Date();
    const targetYear = year || currentDate.getFullYear();
    const targetMonth = month || (currentDate.getMonth() + 1);
    
    const StaffModel = TenantModelFactory.getStaffModel(restaurantSlug);
    const AdvanceSalaryModel = TenantModelFactory.getAdvanceSalaryModel(restaurantSlug);
    const PFDeductionModel = TenantModelFactory.getPFDeductionModel(restaurantSlug);
    const BonusModel = TenantModelFactory.getBonusModel(restaurantSlug);
    
    const staff = await StaffModel.findById(staffId);
    if (!staff) return res.status(404).json({ error: 'Staff not found' });
    
    const baseSalary = staff.salaryAmount || staff.hourlyRate || staff.dayRate || 0;
    
    // Get pending advance salary records
    const pendingAdvances = await AdvanceSalaryModel.find({
      staffId: new mongoose.Types.ObjectId(staffId),
      status: 'held'
    });
    
    const totalAdvanceAmount = pendingAdvances.reduce((sum, advance) => sum + advance.amount, 0);
    
    // Get PF deductions for the month
    const monthStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
    const pfRecord = await PFDeductionModel.findOne({
      staffId: new mongoose.Types.ObjectId(staffId),
      month: monthStr,
      isEnabled: true
    });
    
    const pfDeduction = pfRecord ? pfRecord.totalDeduction : 0;
    
    // Get approved bonuses for the month
    const bonuses = await BonusModel.find({
      staffId: new mongoose.Types.ObjectId(staffId),
      month: monthStr,
      status: { $in: ['approved', 'paid'] }
    });
    
    const totalBonusAmount = bonuses.reduce((sum, bonus) => sum + bonus.amount, 0);
    
    // Calculate final salary
    const grossSalary = baseSalary + totalBonusAmount;
    const totalDeductions = totalAdvanceAmount + pfDeduction;
    const netSalary = grossSalary - totalDeductions;
    
    const salaryBreakdown = {
      staffName: staff.name,
      month: `${targetMonth}/${targetYear}`,
      baseSalary,
      bonuses: {
        total: totalBonusAmount,
        details: bonuses.map(bonus => ({
          id: bonus._id,
          type: bonus.bonusType,
          amount: bonus.amount,
          reason: bonus.reason,
          status: bonus.status
        }))
      },
      grossSalary,
      deductions: {
        advanceSalary: totalAdvanceAmount,
        pfDeduction,
        total: totalDeductions
      },
      netSalary,
      pendingAdvances: pendingAdvances.map(adv => ({
        id: adv._id,
        amount: adv.amount,
        reason: adv.reason,
        heldAt: adv.heldAt
      }))
    };
    
    res.json({ salaryBreakdown });
  } catch (error) {
    console.error('Calculate monthly salary error:', error);
    res.status(500).json({ error: 'Failed to calculate salary' });
  }
};

const processMonthlySalary = async (req, res) => {
  try {
    const { staffId } = req.params;
    const { month, year, autoDeductAdvances = true } = req.body;
    const restaurantSlug = req.user.restaurantSlug;
    const currentUserId = req.user.userId || req.user.id;
    
    const currentDate = new Date();
    const targetYear = year || currentDate.getFullYear();
    const targetMonth = month || (currentDate.getMonth() + 1);
    
    const StaffModel = TenantModelFactory.getStaffModel(restaurantSlug);
    const AdvanceSalaryModel = TenantModelFactory.getAdvanceSalaryModel(restaurantSlug);
    
    const staff = await StaffModel.findById(staffId);
    if (!staff) return res.status(404).json({ error: 'Staff not found' });
    
    const baseSalary = staff.salaryAmount || staff.hourlyRate || staff.dayRate || 0;
    
    if (autoDeductAdvances) {
      // Auto-deduct all pending advances
      const pendingAdvances = await AdvanceSalaryModel.find({
        staffId: new mongoose.Types.ObjectId(staffId),
        status: 'held'
      });
      
      const totalAdvanceAmount = pendingAdvances.reduce((sum, advance) => sum + advance.amount, 0);
      
      // Mark all pending advances as deducted
      await AdvanceSalaryModel.updateMany(
        {
          staffId: new mongoose.Types.ObjectId(staffId),
          status: 'held'
        },
        {
          status: 'deducted',
          deductedAt: new Date()
        }
      );
      
      // Clear advance salary from staff document
      staff.advanceSalary = { amount: 0, reason: '', isHeld: false };
      await staff.save();
      
      res.json({
        message: 'Monthly salary processed with automatic advance deduction',
        staffName: staff.name,
        month: `${targetMonth}/${targetYear}`,
        baseSalary,
        advancesDeducted: totalAdvanceAmount,
        netSalary: baseSalary - totalAdvanceAmount,
        deductedAdvances: pendingAdvances.length
      });
    } else {
      res.json({
        message: 'Monthly salary processed without advance deduction',
        staffName: staff.name,
        month: `${targetMonth}/${targetYear}`,
        baseSalary
      });
    }
  } catch (error) {
    console.error('Process monthly salary error:', error);
    res.status(500).json({ error: 'Failed to process monthly salary' });
  }
};

// ─── BONUS MANAGEMENT ─────────────────────────────────────────────

const addBonus = async (req, res) => {
  try {
    const { staffId } = req.params;
    const { bonusType, amount, percentage, basedOnSalary, reason, description, effectiveDate } = req.body;
    const restaurantSlug = req.user.restaurantSlug;
    const currentUserId = req.user.userId || req.user.id;

    if (!bonusType || !reason) {
      return res.status(400).json({ error: 'Bonus type and reason are required' });
    }

    const StaffModel = TenantModelFactory.getStaffModel(restaurantSlug);
    const BonusModel = TenantModelFactory.getBonusModel(restaurantSlug);

    const staff = await StaffModel.findById(staffId);
    if (!staff) return res.status(404).json({ error: 'Staff member not found' });

    let bonusAmount = amount;
    
    // Calculate bonus based on salary percentage if specified
    if (basedOnSalary && percentage) {
      const baseSalary = staff.salaryAmount || staff.hourlyRate || staff.dayRate || 0;
      bonusAmount = (baseSalary * percentage) / 100;
    }

    if (!bonusAmount || bonusAmount <= 0) {
      return res.status(400).json({ error: 'Valid bonus amount is required' });
    }

    const effectiveMonth = new Date(effectiveDate || Date.now());
    const monthStr = `${effectiveMonth.getFullYear()}-${String(effectiveMonth.getMonth() + 1).padStart(2, '0')}`;

    const bonus = await BonusModel.create({
      staffId,
      staffName: staff.name,
      bonusType,
      amount: bonusAmount,
      percentage: basedOnSalary ? percentage : null,
      basedOnSalary: Boolean(basedOnSalary),
      reason,
      description: description || '',
      status: 'approved', // Auto-approve for now
      effectiveDate: effectiveDate || new Date(),
      month: monthStr,
      year: effectiveMonth.getFullYear(),
      approvedBy: currentUserId,
      approvedAt: new Date(),
      createdBy: currentUserId
    });

    res.status(201).json({ 
      message: 'Bonus added successfully', 
      bonus,
      calculatedAmount: bonusAmount
    });
  } catch (error) {
    console.error('Add bonus error:', error);
    res.status(500).json({ error: 'Failed to add bonus' });
  }
};

const getBonusRecords = async (req, res) => {
  try {
    const { staffId } = req.params;
    const { month, year, bonusType, status } = req.query;
    const restaurantSlug = req.user.restaurantSlug;
    const BonusModel = TenantModelFactory.getBonusModel(restaurantSlug);

    let query = {};
    
    if (staffId) query.staffId = new mongoose.Types.ObjectId(staffId);
    if (bonusType) query.bonusType = bonusType;
    if (status) query.status = status;
    
    if (month && year) {
      const monthStr = `${year}-${String(month).padStart(2, '0')}`;
      query.month = monthStr;
    }

    const bonuses = await BonusModel.find(query)
      .sort({ createdAt: -1 })
      .lean();

    const summary = {
      totalBonuses: bonuses.length,
      totalAmount: bonuses.reduce((sum, bonus) => sum + bonus.amount, 0),
      byType: bonuses.reduce((acc, bonus) => {
        acc[bonus.bonusType] = (acc[bonus.bonusType] || 0) + bonus.amount;
        return acc;
      }, {}),
      byStatus: bonuses.reduce((acc, bonus) => {
        acc[bonus.status] = (acc[bonus.status] || 0) + 1;
        return acc;
      }, {})
    };

    res.json({ bonuses, summary });
  } catch (error) {
    console.error('Get bonus records error:', error);
    res.status(500).json({ error: 'Failed to fetch bonus records' });
  }
};

const updateBonusStatus = async (req, res) => {
  try {
    const { bonusId } = req.params;
    const { status, notes } = req.body;
    const restaurantSlug = req.user.restaurantSlug;
    const currentUserId = req.user.userId || req.user.id;

    if (!['pending', 'approved', 'paid', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const BonusModel = TenantModelFactory.getBonusModel(restaurantSlug);
    const bonus = await BonusModel.findById(bonusId);
    
    if (!bonus) return res.status(404).json({ error: 'Bonus record not found' });

    bonus.status = status;
    if (notes) bonus.notes = notes;
    
    if (status === 'approved') {
      bonus.approvedBy = currentUserId;
      bonus.approvedAt = new Date();
    } else if (status === 'paid') {
      bonus.paidAt = new Date();
    }

    await bonus.save();

    res.json({ 
      message: `Bonus ${status} successfully`, 
      bonus 
    });
  } catch (error) {
    console.error('Update bonus status error:', error);
    res.status(500).json({ error: 'Failed to update bonus status' });
  }
};

const deleteBonus = async (req, res) => {
  try {
    const { bonusId } = req.params;
    const restaurantSlug = req.user.restaurantSlug;
    const BonusModel = TenantModelFactory.getBonusModel(restaurantSlug);

    const bonus = await BonusModel.findById(bonusId);
    if (!bonus) return res.status(404).json({ error: 'Bonus record not found' });

    if (bonus.status === 'paid') {
      return res.status(400).json({ error: 'Cannot delete paid bonus' });
    }

    await BonusModel.findByIdAndDelete(bonusId);
    res.json({ message: 'Bonus deleted successfully' });
  } catch (error) {
    console.error('Delete bonus error:', error);
    res.status(500).json({ error: 'Failed to delete bonus' });
  }
};

// ─── HOLIDAY MANAGEMENT ──────────────────────────────────────────────────────

const addHoliday = async (req, res) => {
  try {
    const { name, date, type, description, isRecurring, recurringType, isPaid, applicableRoles } = req.body;
    const restaurantSlug = req.user.restaurantSlug;
    const currentUserId = req.user.userId || req.user.id;

    if (!name || !date || !type) {
      return res.status(400).json({ error: 'Name, date, and type are required' });
    }

    const HolidayModel = TenantModelFactory.getHolidayModel(restaurantSlug);
    const holidayDate = new Date(date);
    const year = holidayDate.getFullYear();

    // Check if holiday already exists for this date
    const existingHoliday = await HolidayModel.findOne({
      date: {
        $gte: new Date(holidayDate.getFullYear(), holidayDate.getMonth(), holidayDate.getDate()),
        $lt: new Date(holidayDate.getFullYear(), holidayDate.getMonth(), holidayDate.getDate() + 1)
      }
    });

    if (existingHoliday) {
      return res.status(400).json({ error: 'Holiday already exists for this date' });
    }

    const holiday = await HolidayModel.create({
      name,
      date: holidayDate,
      type,
      description: description || '',
      isRecurring: Boolean(isRecurring),
      recurringType: isRecurring ? recurringType : null,
      isPaid: isPaid !== undefined ? Boolean(isPaid) : true,
      applicableRoles: applicableRoles || ['ALL'],
      year,
      createdBy: currentUserId
    });

    res.status(201).json({ 
      message: 'Holiday added successfully', 
      holiday 
    });
  } catch (error) {
    console.error('Add holiday error:', error);
    res.status(500).json({ error: 'Failed to add holiday' });
  }
};

const getHolidays = async (req, res) => {
  try {
    const { year, month, type, isPaid } = req.query;
    const restaurantSlug = req.user.restaurantSlug;
    const HolidayModel = TenantModelFactory.getHolidayModel(restaurantSlug);

    let query = { isActive: true };
    
    if (year) query.year = parseInt(year);
    if (type) query.type = type;
    if (isPaid !== undefined) query.isPaid = Boolean(isPaid);
    
    if (month && year) {
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
      query.date = { $gte: startDate, $lte: endDate };
    }

    const holidays = await HolidayModel.find(query)
      .sort({ date: 1 })
      .lean();

    const summary = {
      totalHolidays: holidays.length,
      paidHolidays: holidays.filter(h => h.isPaid).length,
      unpaidHolidays: holidays.filter(h => !h.isPaid).length,
      byType: holidays.reduce((acc, holiday) => {
        acc[holiday.type] = (acc[holiday.type] || 0) + 1;
        return acc;
      }, {})
    };

    res.json({ holidays, summary });
  } catch (error) {
    console.error('Get holidays error:', error);
    res.status(500).json({ error: 'Failed to fetch holidays' });
  }
};

const updateHoliday = async (req, res) => {
  try {
    const { holidayId } = req.params;
    const { name, date, type, description, isPaid, applicableRoles, isActive } = req.body;
    const restaurantSlug = req.user.restaurantSlug;
    const HolidayModel = TenantModelFactory.getHolidayModel(restaurantSlug);

    const holiday = await HolidayModel.findById(holidayId);
    if (!holiday) return res.status(404).json({ error: 'Holiday not found' });

    if (name) holiday.name = name;
    if (date) {
      holiday.date = new Date(date);
      holiday.year = new Date(date).getFullYear();
    }
    if (type) holiday.type = type;
    if (description !== undefined) holiday.description = description;
    if (isPaid !== undefined) holiday.isPaid = Boolean(isPaid);
    if (applicableRoles) holiday.applicableRoles = applicableRoles;
    if (isActive !== undefined) holiday.isActive = Boolean(isActive);

    await holiday.save();
    res.json({ message: 'Holiday updated successfully', holiday });
  } catch (error) {
    console.error('Update holiday error:', error);
    res.status(500).json({ error: 'Failed to update holiday' });
  }
};

const deleteHoliday = async (req, res) => {
  try {
    const { holidayId } = req.params;
    const restaurantSlug = req.user.restaurantSlug;
    const HolidayModel = TenantModelFactory.getHolidayModel(restaurantSlug);

    const holiday = await HolidayModel.findByIdAndDelete(holidayId);
    if (!holiday) return res.status(404).json({ error: 'Holiday not found' });

    res.json({ message: 'Holiday deleted successfully' });
  } catch (error) {
    console.error('Delete holiday error:', error);
    res.status(500).json({ error: 'Failed to delete holiday' });
  }
};

const checkHolidayForDate = async (req, res) => {
  try {
    const { date } = req.query;
    const restaurantSlug = req.user.restaurantSlug;
    const HolidayModel = TenantModelFactory.getHolidayModel(restaurantSlug);

    if (!date) {
      return res.status(400).json({ error: 'Date parameter required' });
    }

    const checkDate = new Date(date);
    const holiday = await HolidayModel.findOne({
      date: {
        $gte: new Date(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate()),
        $lt: new Date(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate() + 1)
      },
      isActive: true
    });

    res.json({ 
      isHoliday: !!holiday,
      holiday: holiday || null,
      shouldDeductSalary: holiday ? !holiday.isPaid : true
    });
  } catch (error) {
    console.error('Check holiday error:', error);
    res.status(500).json({ error: 'Failed to check holiday' });
  }
};
module.exports = {
  holdAdvanceSalary,
  releaseAdvanceSalary,
  deductAdvanceSalary,
  getAdvanceSalaryRecords,
  setPFDeduction,
  deductEmployerPF,
  getPFDeductionRecords,
  markPFDeducted,
  calculateMonthlySalary,
  processMonthlySalary,
  addBonus,
  getBonusRecords,
  updateBonusStatus,
  deleteBonus,
  addHoliday,
  getHolidays,
  updateHoliday,
  deleteHoliday,
  checkHolidayForDate
};
