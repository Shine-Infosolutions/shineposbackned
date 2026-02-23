const mongoose = require('mongoose');

const discountUsageSchema = new mongoose.Schema({
  discountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Discount', required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  discountAmount: { type: Number, required: true },
  usedAt: { type: Date, default: Date.now }
}, { timestamps: true });

discountUsageSchema.index({ discountId: 1, customerId: 1 });
discountUsageSchema.index({ restaurantId: 1, usedAt: -1 });

module.exports = mongoose.model('DiscountUsage', discountUsageSchema);
