const mongoose = require('mongoose');

const loyaltySettingsSchema = new mongoose.Schema({
  pointsPerRupee: { type: Number, default: 1 },
  redeemRate: { type: Number, default: 10 }
}, { timestamps: true });

module.exports = loyaltySettingsSchema;
