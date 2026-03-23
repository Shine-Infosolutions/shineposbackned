const mongoose = require('mongoose');

const holidaySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  date: {
    type: Date,
    required: true
  },
  type: {
    type: String,
    enum: ['national', 'religious', 'company', 'regional', 'optional'],
    required: true
  },
  description: {
    type: String,
    trim: true
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurringType: {
    type: String,
    enum: ['yearly', 'monthly'],
    default: null
  },
  isPaid: {
    type: Boolean,
    default: true // If true, no salary deduction for this holiday
  },
  isActive: {
    type: Boolean,
    default: true
  },
  applicableRoles: [{
    type: String,
    enum: ['MANAGER', 'CHEF', 'WAITER', 'CASHIER', 'ALL'],
    default: 'ALL'
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    required: true
  },
  year: {
    type: Number,
    required: true
  }
}, {
  timestamps: true
});

holidaySchema.index({ date: 1 });
holidaySchema.index({ type: 1 });
holidaySchema.index({ year: 1 });

module.exports = holidaySchema;