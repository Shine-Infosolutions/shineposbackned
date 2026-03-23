const mongoose = require('mongoose');

const advanceSalarySchema = new mongoose.Schema({
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  staffName: { type: String, required: true },
  amount: { type: Number, required: true, min: 1 },
  reason: { type: String, default: '' },
  status: {
    type: String,
    enum: ['held', 'released', 'deducted'],
    default: 'held'
  },
  heldAt: { type: Date, default: Date.now },
  heldBy: { type: mongoose.Schema.Types.ObjectId },
  releasedAt: { type: Date },
  releasedBy: { type: mongoose.Schema.Types.ObjectId },
  deductedAt: { type: Date },
  notes: { type: String, default: '' }
}, { timestamps: true });

module.exports = advanceSalarySchema;
