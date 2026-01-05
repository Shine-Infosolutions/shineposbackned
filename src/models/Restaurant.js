const mongoose = require('mongoose');

const restaurantSchema = new mongoose.Schema({
  name: {
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
  adminEmail: {
    type: String,
    required: true,
    lowercase: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  slug: {
    type: String,
    unique: true
  },
  adminName: {
    type: String,
    required: true
  },
  phone: String,
  address: String,
  city: String,
  state: String,
  zipCode: String,
  cuisine: String,
  description: String,
  subscriptionPlan: {
    type: String,
    enum: ['trial', 'basic', 'premium', 'enterprise'],
    default: 'trial'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Restaurant', restaurantSchema);