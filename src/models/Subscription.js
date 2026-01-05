const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true,
    unique: true
  },
  plan: {
    type: String,
    enum: ['trial', 'basic', 'premium', 'enterprise'],
    default: 'trial'
  },
  billing: {
    type: String,
    enum: ['monthly', 'yearly'],
    default: 'monthly'
  },
  price: {
    type: Number,
    required: true,
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'cancelled', 'suspended', 'trial', 'overdue'],
    default: 'trial'
  },
  cancelledAt: Date,
  cancellationReason: String,
  trialEndsAt: {
    type: Date,
    default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days
  },
  currentPeriodStart: {
    type: Date,
    default: Date.now
  },
  currentPeriodEnd: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
  },
  nextBillingDate: Date,
  usage: {
    orders: { type: Number, default: 0 },
    storage: { type: Number, default: 0 },
    users: { type: Number, default: 1 },
    lastReset: { type: Date, default: Date.now }
  },
  paymentMethod: {
    type: String,
    cardLast4: String,
    cardBrand: String
  },
  invoices: [{
    invoiceId: String,
    amount: Number,
    status: { type: String, enum: ['pending', 'paid', 'failed', 'overdue'] },
    dueDate: Date,
    paidAt: Date,
    createdAt: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true
});

// Auto-set next billing date
subscriptionSchema.pre('save', function(next) {
  if (this.isModified('currentPeriodEnd')) {
    this.nextBillingDate = this.currentPeriodEnd;
  }
  next();
});

module.exports = mongoose.model('Subscription', subscriptionSchema);