const Order = require('../models/Order');
const Staff = require('../models/Staff');
const Attendance = require('../models/Attendance');
const Table = require('../models/Table');
const ExpectedRevenue = require('../models/ExpectedRevenue');

exports.getAdminDashboard = async (req, res) => {
  try {
    const tenantId = req.tenant._id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Today's revenue
    const todayOrders = await Order.find({
      tenantId,
      createdAt: { $gte: today, $lt: tomorrow },
      status: { $in: ['COMPLETE', 'SERVED'] }
    });
    const todayRevenue = todayOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);

    // Total orders today
    const totalOrders = todayOrders.length;

    // Staff attendance today
    const staffAttendance = await Attendance.find({
      tenantId,
      date: { $gte: today, $lt: tomorrow }
    });
    const presentStaff = staffAttendance.filter(a => a.status === 'PRESENT').length;
    const totalStaff = await Staff.countDocuments({ tenantId });

    // Table occupancy
    const tables = await Table.find({ tenantId });
    const occupiedTables = tables.filter(t => t.status === 'OCCUPIED').length;
    const totalTables = tables.length;

    // Payment methods breakdown
    const paymentBreakdown = {};
    todayOrders.forEach(order => {
      const method = order.paymentMethod || 'CASH';
      paymentBreakdown[method] = (paymentBreakdown[method] || 0) + order.totalAmount;
    });

    // Top items
    const topItems = await Order.aggregate([
      {
        $match: {
          tenantId,
          createdAt: { $gte: today, $lt: tomorrow }
        }
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.itemName',
          count: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    res.json({
      todayRevenue,
      totalOrders,
      staffAttendance: { present: presentStaff, total: totalStaff },
      tableOccupancy: { occupied: occupiedTables, total: totalTables },
      paymentBreakdown,
      topItems
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getStaffPerformance = async (req, res) => {
  try {
    const tenantId = req.tenant._id;
    const month = req.query.month || new Date().getMonth() + 1;
    const year = req.query.year || new Date().getFullYear();

    const staff = await Staff.find({ tenantId });
    const performance = [];

    for (const s of staff) {
      const attendance = await Attendance.find({
        staffId: s._id,
        date: {
          $gte: new Date(year, month - 1, 1),
          $lt: new Date(year, month, 1)
        }
      });

      const present = attendance.filter(a => a.status === 'PRESENT').length;
      const late = attendance.filter(a => a.status === 'LATE').length;
      const absent = attendance.filter(a => a.status === 'ABSENT').length;
      const workingHours = attendance.reduce((sum, a) => sum + (a.workingHours || 0), 0);

      performance.push({
        staffId: s._id,
        name: s.name,
        present,
        late,
        absent,
        workingHours,
        attendanceRate: ((present / (present + late + absent)) * 100).toFixed(2)
      });
    }

    res.json(performance);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getOvertimeStats = async (req, res) => {
  try {
    const tenantId = req.tenant._id;

    const staff = await Staff.find({ tenantId });
    const stats = {
      pending: 0,
      accepted: 0,
      declined: 0,
      inProgress: 0,
      completed: 0,
      staffWise: []
    };

    for (const s of staff) {
      const overtimeRequests = s.overtimeRequests || [];
      const staffStats = {
        staffId: s._id,
        name: s.name,
        pending: overtimeRequests.filter(o => o.status === 'pending').length,
        accepted: overtimeRequests.filter(o => o.status === 'accepted').length,
        declined: overtimeRequests.filter(o => o.status === 'declined').length,
        inProgress: overtimeRequests.filter(o => o.status === 'in-progress').length,
        completed: overtimeRequests.filter(o => o.status === 'completed').length
      };

      stats.pending += staffStats.pending;
      stats.accepted += staffStats.accepted;
      stats.declined += staffStats.declined;
      stats.inProgress += staffStats.inProgress;
      stats.completed += staffStats.completed;
      stats.staffWise.push(staffStats);
    }

    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAttendanceStats = async (req, res) => {
  try {
    const tenantId = req.tenant._id;
    const month = req.query.month || new Date().getMonth() + 1;
    const year = req.query.year || new Date().getFullYear();

    const attendance = await Attendance.find({
      tenantId,
      date: {
        $gte: new Date(year, month - 1, 1),
        $lt: new Date(year, month, 1)
      }
    });

    const stats = {
      present: attendance.filter(a => a.status === 'PRESENT').length,
      late: attendance.filter(a => a.status === 'LATE').length,
      absent: attendance.filter(a => a.status === 'ABSENT').length,
      halfDay: attendance.filter(a => a.status === 'HALF_DAY').length,
      total: attendance.length,
      attendanceRate: ((attendance.filter(a => a.status === 'PRESENT').length / attendance.length) * 100).toFixed(2)
    };

    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getSalaryStats = async (req, res) => {
  try {
    const tenantId = req.tenant._id;
    const month = req.query.month || new Date().getMonth() + 1;
    const year = req.query.year || new Date().getFullYear();

    const staff = await Staff.find({ tenantId });
    const stats = {
      fixed: 0,
      hourly: 0,
      daily: 0,
      total: 0,
      staffWise: []
    };

    for (const s of staff) {
      let salary = 0;
      if (s.salaryType === 'fixed') {
        salary = s.salaryAmount || 0;
        stats.fixed += salary;
      } else if (s.salaryType === 'hourly') {
        const attendance = await Attendance.find({
          staffId: s._id,
          date: {
            $gte: new Date(year, month - 1, 1),
            $lt: new Date(year, month, 1)
          }
        });
        const workingHours = attendance.reduce((sum, a) => sum + (a.workingHours || 0), 0);
        salary = workingHours * (s.hourlyRate || 0);
        stats.hourly += salary;
      } else if (s.salaryType === 'daily') {
        const attendance = await Attendance.find({
          staffId: s._id,
          date: {
            $gte: new Date(year, month - 1, 1),
            $lt: new Date(year, month, 1)
          },
          status: 'PRESENT'
        });
        salary = attendance.length * (s.dayRate || 0);
        stats.daily += salary;
      }

      stats.total += salary;
      stats.staffWise.push({
        staffId: s._id,
        name: s.name,
        salaryType: s.salaryType,
        salary
      });
    }

    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
