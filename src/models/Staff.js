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
  salaryType: {
    type: String,
    enum: ['fixed', 'hourly', 'daily'],
    default: 'fixed'
  },
  salaryAmount: {
    type: Number,
    default: 0
  },
  hourlyRate: {
    type: Number,
    default: 0
  },
  dayRate: {
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
  overtimeRequests: [{
    date: Date,
    startTime: String,
    endTime: String,
    hours: Number,
    reason: String,
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'in-progress', 'completed'],
      default: 'pending'
    },
    assignedBy: mongoose.Schema.Types.ObjectId,
    respondedAt: Date,
    startedAt: Date,
    completedAt: Date,
    actualHours: Number,
    createdAt: { type: Date, default: Date.now }
  }],
  overtimeRecords: [{
    date: { type: Date, default: Date.now },
    startTime: String,
    endTime: String,
    hours: Number,
    rate: Number,
    amount: Number,
    notes: String,
    createdBy: mongoose.Schema.Types.ObjectId,
    createdAt: { type: Date, default: Date.now }
  }],

}, {
  timestamps: true
});

module.exports = staffSchema;