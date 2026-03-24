/**
 * Run once per tenant: node src/scripts/createIndexes.js <restaurantSlug>
 * Or import createIndexesForTenant and call it after tenant creation.
 */
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const TenantModelFactory = require('../models/TenantModelFactory');

const createIndexesForTenant = async (restaurantSlug) => {
  try {
    const Order      = TenantModelFactory.getOrderModel(restaurantSlug);
    const Inventory  = TenantModelFactory.getInventoryModel(restaurantSlug);
    const MenuItem   = TenantModelFactory.getMenuItemModel(restaurantSlug);
    const KOT        = TenantModelFactory.getKOTModel(restaurantSlug);
    const Recipe     = TenantModelFactory.getRecipeModel(restaurantSlug);
    const Staff      = TenantModelFactory.getStaffModel(restaurantSlug);
    const Attendance = TenantModelFactory.getAttendanceModel(restaurantSlug);

    await Promise.all([
      Order.collection.createIndex({ status: 1, createdAt: -1 }),
      Order.collection.createIndex({ createdAt: -1 }),
      Order.collection.createIndex({ tableId: 1, status: 1 }),
      Order.collection.createIndex({ customerPhone: 1 }),
      Inventory.collection.createIndex({ isActive: 1, currentStock: 1 }),
      Inventory.collection.createIndex({ name: 1 }),
      MenuItem.collection.createIndex({ categoryID: 1, status: 1 }),
      MenuItem.collection.createIndex({ status: 1 }),
      KOT.collection.createIndex({ orderId: 1 }),
      KOT.collection.createIndex({ status: 1, createdAt: -1 }),
      Recipe.collection.createIndex({ menuItemId: 1 }, { unique: true }),
      Staff.collection.createIndex({ isActive: 1 }),
      Attendance.collection.createIndex({ staffId: 1, date: -1 }),
    ]);

    console.log(`Indexes created for tenant: ${restaurantSlug}`);
  } catch (err) {
    console.error(`Index creation error for ${restaurantSlug}:`, err.message);
  }
};

// CLI usage
if (require.main === module) {
  const slug = process.argv[2];
  if (!slug) { console.error('Usage: node src/scripts/createIndexes.js <restaurantSlug>'); process.exit(1); }
  mongoose.connect(process.env.MONGODB_URI).then(async () => {
    await createIndexesForTenant(slug);
    process.exit(0);
  });
}

module.exports = { createIndexesForTenant };
