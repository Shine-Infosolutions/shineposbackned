const TenantModelFactory = require('../models/TenantModelFactory');

exports.getAdminDashboard = async (req, res) => {
  try {
    const restaurantSlug = req.user?.restaurantSlug;
    if (!restaurantSlug) return res.status(400).json({ error: 'Restaurant slug not found' });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const OrderModel = TenantModelFactory.getOrderModel(restaurantSlug);
    const StaffModel = TenantModelFactory.getStaffModel(restaurantSlug);
    const AttendanceModel = TenantModelFactory.getAttendanceModel(restaurantSlug);
    const TableModel = TenantModelFactory.getTableModel(restaurantSlug);

    const [todayOrders, staffAttendance, totalStaff, tables] = await Promise.all([
      OrderModel.find({
        createdAt: { $gte: today, $lt: tomorrow },
        status: { $in: ['COMPLETE', 'SERVED'] }
      }).select('totalAmount paymentMethod items').lean(),
      AttendanceModel.find({ date: { $gte: today, $lt: tomorrow } }).select('status').lean(),
      StaffModel.countDocuments(),
      TableModel.find().select('status').lean()
    ]);

    const todayRevenue = todayOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const presentStaff = staffAttendance.filter(a => a.status === 'PRESENT').length;
    const occupiedTables = tables.filter(t => t.status === 'OCCUPIED').length;

    const paymentBreakdown = {};
    todayOrders.forEach(order => {
      const method = order.paymentMethod || 'CASH';
      paymentBreakdown[method] = (paymentBreakdown[method] || 0) + (order.totalAmount || 0);
    });

    // Top items via aggregation
    const topItems = await OrderModel.aggregate([
      { $match: { createdAt: { $gte: today, $lt: tomorrow } } },
      { $unwind: '$items' },
      { $group: { _id: '$items.itemName', count: { $sum: '$items.quantity' }, revenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    res.json({
      todayRevenue,
      totalOrders: todayOrders.length,
      staffAttendance: { present: presentStaff, total: totalStaff },
      tableOccupancy: { occupied: occupiedTables, total: tables.length },
      paymentBreakdown,
      topItems
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getStaffPerformance = async (req, res) => {
  try {
    const restaurantSlug = req.user?.restaurantSlug;
    if (!restaurantSlug) return res.status(400).json({ error: 'Restaurant slug not found' });

    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year) || new Date().getFullYear();

    const StaffModel = TenantModelFactory.getStaffModel(restaurantSlug);
    const AttendanceModel = TenantModelFactory.getAttendanceModel(restaurantSlug);

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);

    const [staff, allAttendance] = await Promise.all([
      StaffModel.find().select('name').lean(),
      AttendanceModel.find({ date: { $gte: startDate, $lt: endDate } }).select('staffId status workingHours').lean()
    ]);

    // Group attendance by staffId in memory
    const attendanceByStaff = {};
    allAttendance.forEach(a => {
      const key = a.staffId.toString();
      if (!attendanceByStaff[key]) attendanceByStaff[key] = [];
      attendanceByStaff[key].push(a);
    });

    const performance = staff.map(s => {
      const records = attendanceByStaff[s._id.toString()] || [];
      const present = records.filter(a => a.status === 'PRESENT').length;
      const late = records.filter(a => a.status === 'LATE').length;
      const absent = records.filter(a => a.status === 'ABSENT').length;
      const workingHours = records.reduce((sum, a) => sum + (a.workingHours || 0), 0);
      const total = present + late + absent;
      return { staffId: s._id, name: s.name, present, late, absent, workingHours, attendanceRate: total > 0 ? ((present / total) * 100).toFixed(2) : '0' };
    });

    res.json(performance);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAttendanceStats = async (req, res) => {
  try {
    const restaurantSlug = req.user?.restaurantSlug;
    if (!restaurantSlug) return res.status(400).json({ error: 'Restaurant slug not found' });

    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year) || new Date().getFullYear();

    const AttendanceModel = TenantModelFactory.getAttendanceModel(restaurantSlug);
    const attendance = await AttendanceModel.find({
      date: { $gte: new Date(year, month - 1, 1), $lt: new Date(year, month, 1) }
    }).select('status').lean();

    const total = attendance.length;
    const present = attendance.filter(a => a.status === 'PRESENT').length;
    res.json({
      present,
      late: attendance.filter(a => a.status === 'LATE').length,
      absent: attendance.filter(a => a.status === 'ABSENT').length,
      halfDay: attendance.filter(a => a.status === 'HALF_DAY').length,
      total,
      attendanceRate: total > 0 ? ((present / total) * 100).toFixed(2) : '0'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getSalaryStats = async (req, res) => {
  try {
    const restaurantSlug = req.user?.restaurantSlug;
    if (!restaurantSlug) return res.status(400).json({ error: 'Restaurant slug not found' });

    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year) || new Date().getFullYear();

    const StaffModel = TenantModelFactory.getStaffModel(restaurantSlug);
    const AttendanceModel = TenantModelFactory.getAttendanceModel(restaurantSlug);

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);

    const [staff, allAttendance] = await Promise.all([
      StaffModel.find().select('name salaryType salaryAmount hourlyRate dayRate').lean(),
      AttendanceModel.find({ date: { $gte: startDate, $lt: endDate } }).select('staffId status workingHours').lean()
    ]);

    const attendanceByStaff = {};
    allAttendance.forEach(a => {
      const key = a.staffId.toString();
      if (!attendanceByStaff[key]) attendanceByStaff[key] = [];
      attendanceByStaff[key].push(a);
    });

    const stats = { fixed: 0, hourly: 0, daily: 0, total: 0, staffWise: [] };

    staff.forEach(s => {
      const records = attendanceByStaff[s._id.toString()] || [];
      let salary = 0;
      if (s.salaryType === 'fixed') {
        salary = s.salaryAmount || 0;
        stats.fixed += salary;
      } else if (s.salaryType === 'hourly') {
        const workingHours = records.reduce((sum, a) => sum + (a.workingHours || 0), 0);
        salary = workingHours * (s.hourlyRate || 0);
        stats.hourly += salary;
      } else if (s.salaryType === 'daily') {
        const presentDays = records.filter(a => a.status === 'PRESENT').length;
        salary = presentDays * (s.dayRate || 0);
        stats.daily += salary;
      }
      stats.total += salary;
      stats.staffWise.push({ staffId: s._id, name: s.name, salaryType: s.salaryType, salary });
    });

    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// getOvertimeStats removed — relied on broken embedded overtimeRequests pattern
