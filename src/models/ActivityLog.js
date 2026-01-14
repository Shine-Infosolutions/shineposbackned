const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'users',
    required: true
  },
  userRole: {
    type: String,
    required: true
  },
  restaurantSlug: {
    type: String,
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      'VIEW', 'CREATE', 'UPDATE', 'DELETE',
      'BILL_CANCELLED', 'REFUND_ISSUED', 'DISCOUNT_APPLIED',
      'ORDER_CANCELLED', 'PAYMENT_RECEIVED', 'INVENTORY_ADJUSTED',
      'LOGIN', 'LOGOUT', 'LOGIN_FAILED', 'ACCESS_DENIED',
      'SHIFT_STARTED', 'SHIFT_ENDED', 'DAY_CLOSED'
    ]
  },
  resource: {
    type: String,
    required: true
  },
  resourceId: {
    type: mongoose.Schema.Types.ObjectId
  },
  details: {
    type: mongoose.Schema.Types.Mixed
  },
  reason: String,
  beforeValue: mongoose.Schema.Types.Mixed,
  afterValue: mongoose.Schema.Types.Mixed,
  shiftId: mongoose.Schema.Types.ObjectId,
  ipAddress: String,
  userAgent: String,
  success: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

activityLogSchema.index({ restaurantSlug: 1, createdAt: -1 });
activityLogSchema.index({ userId: 1, createdAt: -1 });
activityLogSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);