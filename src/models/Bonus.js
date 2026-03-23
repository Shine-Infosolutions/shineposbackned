const mongoose = require('mongoose');

const bonusSchema = new mongoose.Schema({
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Staff'
  },
  staffName: { 
    type: String, 
    required: true 
  },
  bonusType: {
    type: String,
    enum: ['performance', 'festival', 'annual', 'achievement', 'overtime', 'custom'],
    required: true
  },
  amount: { 
    type: Number, 
    required: true, 
    min: 1 
  },
  percentage: {
    type: Number,
    min: 0,
    max: 100
  },
  basedOnSalary: {
    type: Boolean,
    default: false
  },
  reason: { 
    type: String, 
    required: true 
  },
  description: { 
    type: String, 
    default: '' 
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'paid', 'cancelled'],
    default: 'pending'
  },
  effectiveDate: {
    type: Date,
    default: Date.now
  },
  approvedBy: { 
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff'
  },
  approvedAt: { 
    type: Date 
  },
  paidAt: { 
    type: Date 
  },
  month: {
    type: String // Format: "2024-01"
  },
  year: {
    type: Number
  },
  notes: { 
    type: String, 
    default: '' 
  },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    required: true
  }
}, { 
  timestamps: true 
});

bonusSchema.index({ staffId: 1, month: 1 });
bonusSchema.index({ bonusType: 1 });
bonusSchema.index({ status: 1 });

module.exports = bonusSchema;