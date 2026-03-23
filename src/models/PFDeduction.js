const mongoose = require('mongoose');

const pfDeductionSchema = new mongoose.Schema({
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  staffName: { type: String, required: true },
  salaryAmount: { type: Number, default: 0 },
  month: { type: String, required: true }, // e.g. "2025-07"

  // Auto 2.5% employee contribution
  employeePercentage: { type: Number, default: 2.5 },
  employeeDeduction: { type: Number, default: 0 },

  // Extra 2.5% employer contribution (manual click)
  employerPercentage: { type: Number, default: 2.5 },
  employerDeduction: { type: Number, default: 0 },
  employerDeducted: { type: Boolean, default: false },
  employerDeductedAt: { type: Date },

  totalDeduction: { type: Number, default: 0 },
  isEnabled: { type: Boolean, default: true },
  status: {
    type: String,
    enum: ['active', 'deducted', 'cancelled'],
    default: 'active'
  },
  setBy: { type: mongoose.Schema.Types.ObjectId },
  notes: { type: String, default: '' }
}, { timestamps: true });

module.exports = pfDeductionSchema;
