const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');

const connectDB = require('./utils/database');
require('./middleware/autoSave');

// Import routes
const authRoutes = require('./routes/auth');
const restaurantRoutes = require('./routes/restaurants');
const menuRoutes = require('./routes/menuItems');
const orderRoutes = require('./routes/orders');
const inventoryRoutes = require('./routes/inventory');
const staffRoutes = require('./routes/staff');
const attendanceRoutes = require('./routes/attendance');
const kitchenRoutes = require('./routes/kitchen');
const systemRoutes = require('./routes/system');
const analyticsRoutes = require('./routes/analytics');
const subscriptionRoutes = require('./routes/subscriptions');
const subscriptionStatusRoutes = require('./routes/subscription');
const subscriptionPlanRoutes = require('./routes/subscriptionPlans');
const settingsRoutes = require('./routes/settings');
const communicationRoutes = require('./routes/communication');
const userManagementRoutes = require('./routes/userManagement');
const paymentRoutes = require('./routes/payment');
const categoryRoutes = require('./routes/category');
const addonRoutes = require('./routes/addon');
const variationRoutes = require('./routes/variation');
const activityLogRoutes = require('./routes/activityLog');
const kotRoutes = require('./routes/kot');
const tableRoutes = require('./routes/table');
const uploadRoutes = require('./routes/upload');
const dashboardRoutes = require('./routes/dashboard');
const digitalMenuRoutes = require('./routes/digitalMenu');
const modulesRoutes = require('./routes/modules');
const splitBillRoutes = require('./routes/splitBill');
const crmRoutes = require('./routes/crm');
const itemAnalysisRoutes = require('./routes/itemAnalysis');
const discountRoutes = require('./routes/discount');
const taxReportsRoutes = require('./routes/taxReports');
const salaryRoutes = require('./routes/salary');
const systemController = require('./controllers/systemController');
const { trackApiMetrics } = systemController;

const app = express();

// Connect to MongoDB
connectDB();

// Rate limiting
const rateLimit = require('express-rate-limit');
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  keyGenerator: (req) => req.user?.restaurantSlug || req.ip,
  message: { error: 'Too many requests, please slow down.' },
  standardHeaders: true,
  legacyHeaders: false
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => req.ip,
  message: { error: 'Too many login attempts, try again later.' }
});

// Initialize default settings — only in primary/single process, not every cluster worker
if (!process.env.CLUSTER_WORKER) {
  const { initializeDefaultSettings } = require('./controllers/settingsController');
  setTimeout(() => { initializeDefaultSettings(); }, 3000);
}

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:5000",
    "https://shineposbackned.vercel.app",
    "https://shinepos-iota.vercel.app",
    "https://shinepos.vercel.app",
  ]
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: true }));
// Upload routes need higher limit — applied per-route in upload.js

// Request ID middleware
app.use((req, res, next) => {
  req.id = uuidv4();
  res.setHeader('X-Request-Id', req.id);
  next();
});

// Request timeout — 30s
app.use((req, res, next) => {
  res.setTimeout(30000, () => {
    res.status(503).json({ error: 'Request timeout' });
  });
  next();
});
app.use(trackApiMetrics);
app.use('/api/', apiLimiter);
// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/menus', menuRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/kitchen', kitchenRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/subscription', subscriptionStatusRoutes);
app.use('/api/subscription-plans', subscriptionPlanRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/communication', communicationRoutes);
app.use('/api/user-management', userManagementRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/addon', addonRoutes);
app.use('/api/variation', variationRoutes);
app.use('/api/activity', activityLogRoutes);
app.use('/api/kot', kotRoutes);
app.use('/api/table', tableRoutes);
app.use('/api/upload', express.json({ limit: '50mb' }), express.urlencoded({ limit: '50mb', extended: true }), uploadRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/modules', modulesRoutes);
app.use('/api/split-bill', splitBillRoutes);
app.use('/api', crmRoutes);
app.use('/api/reports/items', itemAnalysisRoutes);
app.use('/api/discounts', discountRoutes);
app.use('/api/reports/tax', taxReportsRoutes);
app.use('/api/salary', salaryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/:restaurantSlug/orders', orderRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'API is running' });
})
// Health check — deep
app.get('/api/health', async (req, res) => {
  const dbState = mongoose.connection.readyState; // 1 = connected
  if (dbState !== 1) {
    return res.status(503).json({ status: 'ERROR', db: 'disconnected' });
  }
  res.json({ status: 'OK', db: 'connected', pid: process.pid, uptime: Math.floor(process.uptime()) });
});
// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    method: req.method,
    url: req.originalUrl
  });
});

const PORT = process.env.PORT || 5001;
const server = app.listen(PORT, () => {
  console.log(`Worker ${process.pid} running on port ${PORT}`);
});

// Graceful shutdown
const shutdown = async (signal) => {
  console.log(`${signal} received, shutting down gracefully...`);
  server.close(async () => {
    try {
      await mongoose.connection.close();
      console.log('MongoDB connection closed');
    } catch (e) { /* ignore */ }
    process.exit(0);
  });
  // Force exit after 15s if graceful shutdown hangs
  setTimeout(() => process.exit(1), 15000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  shutdown('uncaughtException');
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

