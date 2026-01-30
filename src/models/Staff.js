const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['MANAGER', 'CHEF', 'WAITER', 'CASHIER'],
    required: true
  },
  permissions: [{
    type: String,
    enum: ['orders', 'menus', 'inventory', 'staff', 'reports', 'kitchen']
  }],
  phone: String,
  hourlyRate: {
    type: Number,
    default: 0
  },
  overtimeRate: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  workingHours: {
    standardHours: { type: Number, default: 8 }
  },
  shiftSchedule: mongoose.Schema.Types.Mixed,
  shifts: [{
    date: Date,
    startTime: String,
    endTime: String,
    shiftType: String,
    status: {
      type: String,
      enum: ['scheduled', 'completed', 'missed', 'cancelled'],
      default: 'scheduled'
    }
  }],
  performance: {
    ordersProcessed: { type: Number, default: 0 },
    averageOrderTime: { type: Number, default: 0 },
    customerRating: { type: Number, default: 0 }
  },

}, {
  timestamps: true
});

module.exports = staffSchema;