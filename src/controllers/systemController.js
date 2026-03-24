const SystemHealth = require('../models/SystemHealth');
const mongoose = require('mongoose');
const os = require('os');

let requestCount = 0;
let errorCount = 0;
let responseTimes = [];

// Middleware to track API metrics
const trackApiMetrics = (req, res, next) => {
  const start = Date.now();
  requestCount++;
  
  res.on('finish', () => {
    const responseTime = Date.now() - start;
    responseTimes.push(responseTime);
    
    if (res.statusCode >= 400) {
      errorCount++;
    }
    
    // Keep only last 100 response times
    if (responseTimes.length > 100) {
      responseTimes = responseTimes.slice(-100);
    }
  });
  
  next();
};

const getSystemHealth = async (req, res) => {
  try {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    const dbConnected = mongoose.connection.readyState === 1;
    
    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
      : 0;
    
    const errorRate = requestCount > 0 ? (errorCount / requestCount) * 100 : 0;
    
    const healthData = {
      serverStatus: {
        uptime: process.uptime(),
        memoryUsage: {
          rss: memUsage.rss,
          heapTotal: memUsage.heapTotal,
          heapUsed: memUsage.heapUsed,
          external: memUsage.external
        },
        cpuUsage: (cpuUsage.user + cpuUsage.system) / 1000000
      },
      databaseStatus: {
        connected: dbConnected,
        activeConnections: mongoose.connections.length
      },
      apiMetrics: {
        totalRequests: requestCount,
        errorRate,
        averageResponseTime: avgResponseTime
      }
    };
    
    res.json(healthData);
  } catch (error) {
    console.error('System health error:', error);
    res.status(500).json({ error: 'Failed to get system health' });
  }
};

const getHealthHistory = async (req, res) => {
  try {
    const { hours = 24 } = req.query;
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const healthHistory = await SystemHealth.find({
      timestamp: { $gte: startTime }
    }).sort({ timestamp: 1 });
    
    res.json({ healthHistory });
  } catch (error) {
    console.error('Health history error:', error);
    res.status(500).json({ error: 'Failed to get health history' });
  }
};

module.exports = {
  trackApiMetrics,
  getSystemHealth,
  getHealthHistory
};