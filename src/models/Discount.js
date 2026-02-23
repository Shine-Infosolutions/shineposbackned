const mongoose = require('mongoose');

const discountSchema = new mongoose.Schema({
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  name: { type: String, required: true },
  code: { type: String, uppercase: true, sparse: true },
  type: { 
    type: String, 
    enum: ['coupon', 'happy_hour', 'bulk', 'employee', 'birthday', 'anniversary'], 
    required: true 
  },
  discountType: { type: String, enum: ['percentage', 'fixed'], required: true },
  value: { type: Number, required: true },
  minOrderAmount: { type: Number, default: 0 },
  maxDiscountAmount: { type: Number },
  applicableItems: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' }],
  applicableCategories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
  applyToAll: { type: Boolean, default: false },
  
  // Happy Hour specific
  timeSlots: [{
    startTime: String,
    endTime: String,
    daysOfWeek: [{ type: Number, min: 0, max: 6 }]
  }],
  
  // Bulk discount specific
  bulkRules: [{
    minQuantity: Number,
    discountPercentage: Number
  }],
  
  // Employee discount
  employeeIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Staff' }],
  allEmployees: { type: Boolean, default: false },
  
  // Usage limits
  usageLimit: { type: Number },
  usageCount: { type: Number, default: 0 },
  perUserLimit: { type: Number },
  
  validFrom: { type: Date, required: true },
  validUntil: { type: Date, required: true },
  isActive: { type: Boolean, default: true },
  
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

discountSchema.index({ restaurantId: 1, code: 1 });
discountSchema.index({ restaurantId: 1, type: 1, isActive: 1 });

module.exports = mongoose.model('Discount', discountSchema);
