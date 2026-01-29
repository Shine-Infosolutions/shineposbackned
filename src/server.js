const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');

const connectDB = require('./utils/database');
// Auto-save middleware
require('./middleware/autoSave');

// Migration for extraItems
const { migrateExtraItems } = require('./utils/migrateExtraItems');

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
const digitalMenuRoutes = require('./routes/digitalMenu');
const zomatoSyncRoutes = require('./routes/zomatoSync');
const dynoOrderRoutes = require('./routes/dynoOrder');
const systemController = require('./controllers/systemController');
const { trackApiMetrics } = systemController;

const app = express();

// Connect to MongoDB
connectDB();

// Initialize default settings
const { initializeDefaultSettings } = require('./controllers/settingsController');
initializeDefaultSettings();

// Run migration for extraItems
setTimeout(() => {
  migrateExtraItems();
}, 2000);

// Middleware
app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:5000",
    "https://shineposbackned.vercel.app",
    "https://shinepos-iota.vercel.app",
    "https://shinepos.vercel.app",
  ]
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(trackApiMetrics); // Track API metrics for monitoring
// Routes
app.use('/api/auth', authRoutes);
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
app.use('/api/upload', uploadRoutes);
app.use('/api/zomato', zomatoSyncRoutes);
app.use('/api/dyno', dynoOrderRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/orders', orderRoutes.webhookRouter);
app.use('/api/:restaurantSlug/orders', orderRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'API is running' });
})
// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Restaurant SaaS API is running' });
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
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});