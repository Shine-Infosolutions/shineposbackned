const mongoose = require('mongoose');

const overtimeSchema = new mongoose.Schema({
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    required: true
  },
  staffName: String,
  date: {
    type: Date,
    required: true
  },
  startTime: String,
  endTime: String,
  hours: {
    type: Number,
    required: true
  },
  rate: {
    type: Number,
    default: 0
  },
  amount: {
    type: Number,
    default: 0
  },
  reason: String,
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined'],
    default: 'pending'
  },
  respondedAt: Date,
  assignedBy: mongoose.Schema.Types.ObjectId,
  notes: String,
  actualHoursWorked: {
    type: Number,
    default: 0
  },
  actualRate: {
    type: Number,
    default: 0
  },
  declinedAt: Date,
  completedAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = overtimeSchema;
