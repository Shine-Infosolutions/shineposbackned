const ActivityLog = require('../models/ActivityLog');

const getActivityLogs = async (req, res) => {
  try {
    const { page = 1, limit = 50, userId, action, resource } = req.query;
    
    const filter = {};
    if (userId) filter.userId = userId;
    if (action) filter.action = action;
    if (resource) filter.resource = resource;

    // Since we're using a separate database connection, we can't populate across databases
    // So we'll fetch logs without population for now
    const logs = await ActivityLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await ActivityLog.countDocuments(filter);

    res.json({
      logs,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get activity logs error:', error);
    res.status(500).json({ error: 'Failed to fetch activity logs' });
  }
};

const getUserActivityLogs = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const logs = await ActivityLog.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    res.json({ logs });
  } catch (error) {
    console.error('Get user activity logs error:', error);
    res.status(500).json({ error: 'Failed to fetch user activity logs' });
  }
};

module.exports = {
  getActivityLogs,
  getUserActivityLogs
};