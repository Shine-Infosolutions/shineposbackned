const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ['email', 'sms'], required: true },
  subject: { type: String },
  message: { type: String, required: true },
  targetAudience: { type: String, enum: ['all', 'vip', 'frequent'], default: 'all' },
  minSpent: { type: Number, default: 0 },
  minOrders: { type: Number, default: 0 },
  status: { type: String, enum: ['draft', 'scheduled', 'sent'], default: 'draft' },
  sentCount: { type: Number, default: 0 },
  sentAt: { type: Date }
}, { timestamps: true });

module.exports = campaignSchema;
