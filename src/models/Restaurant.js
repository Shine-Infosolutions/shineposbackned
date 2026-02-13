const mongoose = require('mongoose');

const restaurantSchema = new mongoose.Schema({
  restaurantName: {
    type: String,
    required: true,
    trim: true
  },
  ownerName: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  phone: String,
  restaurantPhone: String,
  address: String,
  city: String,
  state: String,
  pinCode: String,
  cuisine: String,
  description: String,
  subscriptionPlan: {
    type: String,
    enum: ['trial', 'subscription', 'cancelled', 'standard'],
    default: 'trial'
  },
  subscriptionStartDate: Date,
  subscriptionEndDate: Date,
  pausedTimeRemaining: Number,
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'expired', 'cancelled'],
    default: 'pending'
  },
  paymentHistory: [{
    planName: String,
    amount: Number,
    paymentMethod: String,
    transactionId: String,
    status: String,
    paidAt: Date
  }],
  metadata: {
    zomato_res_id: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  marginCostPercentage: {
    type: Number,
    default: 40,
    min: 0,
    max: 100
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Restaurant', restaurantSchema);