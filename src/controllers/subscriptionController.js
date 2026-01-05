const Subscription = require('../models/Subscription');
const Restaurant = require('../models/Restaurant');
const PlanConfig = require('../models/PlanConfig');
const TenantModelFactory = require('../models/TenantModelFactory');

// Initialize default plan configurations if they don't exist
const initializePlanConfigs = async () => {
  const defaultPlans = [
    { plan: 'trial', pricing: { monthly: 0, yearly: 0 } },
    { plan: 'basic', pricing: { monthly: 29, yearly: 290 } },
    { plan: 'premium', pricing: { monthly: 79, yearly: 790 } },
    { plan: 'enterprise', pricing: { monthly: 199, yearly: 1990 } }
  ];

  for (const planData of defaultPlans) {
    const existing = await PlanConfig.findOne({ plan: planData.plan });
    if (!existing) {
      await PlanConfig.create(planData);
    }
  }
};

// Initialize on module load
initializePlanConfigs().catch(console.error);

const createSubscription = async (req, res) => {
  try {
    const { restaurantId, plan = 'trial', billing = 'monthly' } = req.body;
    
    // Check if subscription already exists
    const existingSubscription = await Subscription.findOne({ restaurantId });
    if (existingSubscription) {
      return res.status(400).json({ error: 'Subscription already exists for this restaurant' });
    }
    
    // Get plan configuration from database
    const planConfig = await PlanConfig.findOne({ plan });
    if (!planConfig) {
      return res.status(400).json({ error: 'Invalid plan selected' });
    }
    
    const price = planConfig.pricing[billing];
    
    const subscription = new Subscription({
      restaurantId,
      plan,
      billing,
      price,
      status: plan === 'trial' ? 'trial' : 'active'
    });
    
    await subscription.save();
    await subscription.populate('restaurantId', 'name slug');
    
    res.status(201).json({ message: 'Subscription created successfully', subscription });
  } catch (error) {
    console.error('Create subscription error:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
};

const getSubscriptions = async (req, res) => {
  try {
    const subscriptions = await Subscription.find()
      .populate('restaurantId', 'name slug isActive')
      .sort({ createdAt: -1 });
    
    res.json({ subscriptions });
  } catch (error) {
    console.error('Get subscriptions error:', error);
    res.status(500).json({ error: 'Failed to get subscriptions' });
  }
};

const getRestaurantSubscription = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    
    const subscription = await Subscription.findOne({ restaurantId })
      .populate('restaurantId', 'name slug');
    
    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }
    
    res.json({ subscription });
  } catch (error) {
    console.error('Get restaurant subscription error:', error);
    res.status(500).json({ error: 'Failed to get subscription' });
  }
};

const updateSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const { plan, billing, limits } = req.body;
    
    const subscription = await Subscription.findById(id);
    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }
    
    // Update plan and pricing if provided
    if (plan) {
      const planConfig = await PlanConfig.findOne({ plan });
      if (!planConfig) {
        return res.status(400).json({ error: 'Invalid plan selected' });
      }
      
      subscription.plan = plan;
      subscription.price = planConfig.pricing[billing || subscription.billing];
      
      // Reset usage if upgrading
      if (plan !== 'trial') {
        subscription.status = 'active';
      }
    }
    
    // Update billing cycle if provided
    if (billing) {
      const planConfig = await PlanConfig.findOne({ plan: subscription.plan });
      subscription.billing = billing;
      subscription.price = planConfig.pricing[billing];
    }
    
    // Update custom limits if provided
    if (limits) {
      // Limits are no longer used
    }
    
    await subscription.save();
    await subscription.populate('restaurantId', 'name slug');
    
    res.json({ message: 'Subscription updated successfully', subscription });
  } catch (error) {
    console.error('Update subscription error:', error);
    res.status(500).json({ error: 'Failed to update subscription' });
  }
};

const processPayment = async (req, res) => {
  try {
    const { subscriptionId, paymentMethod } = req.body;
    
    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }
    
    // Simulate payment processing (integrate with Stripe, PayPal, etc.)
    const paymentResult = {
      success: Math.random() > 0.05, // 95% success rate
      transactionId: 'txn_' + Date.now(),
      amount: subscription.price
    };
    
    const invoice = {
      invoiceId: 'inv_' + Date.now(),
      amount: subscription.price,
      status: paymentResult.success ? 'paid' : 'failed',
      dueDate: subscription.nextBillingDate,
      paidAt: paymentResult.success ? new Date() : null
    };
    
    subscription.invoices.push(invoice);
    
    if (paymentResult.success) {
      // Extend subscription period
      const periodLength = subscription.billing === 'yearly' ? 365 : 30;
      subscription.currentPeriodStart = new Date();
      subscription.currentPeriodEnd = new Date(Date.now() + periodLength * 24 * 60 * 60 * 1000);
      subscription.status = 'active';
      
      // Update payment method
      if (paymentMethod) {
        subscription.paymentMethod = paymentMethod;
      }
    } else {
      subscription.status = 'overdue';
    }
    
    await subscription.save();
    
    res.json({
      message: paymentResult.success ? 'Payment processed successfully' : 'Payment failed',
      paymentResult,
      invoice,
      subscription
    });
  } catch (error) {
    console.error('Process payment error:', error);
    res.status(500).json({ error: 'Failed to process payment' });
  }
};

const updateUsage = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { orders, storage, users } = req.body;
    
    const subscription = await Subscription.findOne({ restaurantId });
    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }
    
    // Update usage
    if (orders !== undefined) subscription.usage.orders = orders;
    if (storage !== undefined) subscription.usage.storage = storage;
    if (users !== undefined) subscription.usage.users = users;
    
    subscription.usage.lastReset = new Date();
    
    await subscription.save();
    
    res.json({ 
      message: 'Usage updated successfully', 
      usage: subscription.usage
    });
  } catch (error) {
    console.error('Update usage error:', error);
    res.status(500).json({ error: 'Failed to update usage' });
  }
};

const getBillingReport = async (req, res) => {
  try {
    const subscriptions = await Subscription.find().populate('restaurantId', 'name');
    
    const report = {
      totalRevenue: 0,
      monthlyRecurringRevenue: 0,
      yearlyRecurringRevenue: 0,
      subscriptionsByStatus: {
        trial: 0,
        active: 0,
        cancelled: 0,
        suspended: 0,
        overdue: 0
      },
      subscriptionsByPlan: {
        trial: 0,
        basic: 0,
        premium: 0,
        enterprise: 0
      },
      upcomingRenewals: [],
      overdueInvoices: []
    };
    
    subscriptions.forEach(sub => {
      // Revenue calculations
      if (sub.status === 'active') {
        report.totalRevenue += sub.price;
        if (sub.billing === 'monthly') {
          report.monthlyRecurringRevenue += sub.price;
        } else {
          report.yearlyRecurringRevenue += sub.price;
        }
      }
      
      // Status counts
      report.subscriptionsByStatus[sub.status]++;
      report.subscriptionsByPlan[sub.plan]++;
      
      // Upcoming renewals (next 30 days)
      if (sub.nextBillingDate && sub.nextBillingDate <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)) {
        report.upcomingRenewals.push({
          restaurantName: sub.restaurantId.name,
          amount: sub.price,
          dueDate: sub.nextBillingDate
        });
      }
      
      // Overdue invoices
      sub.invoices.forEach(invoice => {
        if (invoice.status === 'overdue' || (invoice.status === 'pending' && invoice.dueDate < new Date())) {
          report.overdueInvoices.push({
            restaurantName: sub.restaurantId.name,
            invoiceId: invoice.invoiceId,
            amount: invoice.amount,
            dueDate: invoice.dueDate
          });
        }
      });
    });
    
    res.json({ report, subscriptions });
  } catch (error) {
    console.error('Billing report error:', error);
    res.status(500).json({ error: 'Failed to get billing report' });
  }
};

const cancelSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const subscription = await Subscription.findById(id);
    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }
    
    if (subscription.status === 'cancelled') {
      return res.status(400).json({ error: 'Subscription is already cancelled' });
    }
    
    // Cancel subscription but keep access until period end
    subscription.status = 'cancelled';
    subscription.cancelledAt = new Date();
    subscription.cancellationReason = reason || 'No reason provided';
    
    await subscription.save();
    await subscription.populate('restaurantId', 'name slug');
    
    res.json({ 
      message: 'Subscription cancelled successfully. Access will continue until the end of current billing period.',
      subscription,
      accessUntil: subscription.currentPeriodEnd
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
};

const reactivateSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    
    const subscription = await Subscription.findById(id);
    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }
    
    if (subscription.status !== 'cancelled') {
      return res.status(400).json({ error: 'Only cancelled subscriptions can be reactivated' });
    }
    
    subscription.status = 'active';
    subscription.cancelledAt = undefined;
    subscription.cancellationReason = undefined;
    
    await subscription.save();
    await subscription.populate('restaurantId', 'name slug');
    
    res.json({ message: 'Subscription reactivated successfully', subscription });
  } catch (error) {
    console.error('Reactivate subscription error:', error);
    res.status(500).json({ error: 'Failed to reactivate subscription' });
  }
};

const updateSubscriptionLimits = async (req, res) => {
  try {
    const { id } = req.params;
    
    const subscription = await Subscription.findById(id);
    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }
    
    await subscription.populate('restaurantId', 'name slug');
    
    res.json({ message: 'No limits to update - all plans have unlimited access', subscription });
  } catch (error) {
    console.error('Update subscription limits error:', error);
    res.status(500).json({ error: 'Failed to update subscription limits' });
  }
};

const updatePlanConfig = async (req, res) => {
  try {
    const { plan } = req.params;
    const { pricing } = req.body;
    
    const planConfig = await PlanConfig.findOneAndUpdate(
      { plan },
      { pricing },
      { new: true, upsert: true }
    );
    
    res.json({ message: 'Plan configuration updated successfully', planConfig });
  } catch (error) {
    console.error('Update plan config error:', error);
    res.status(500).json({ error: 'Failed to update plan configuration' });
  }
};

const getPlanConfigs = async (req, res) => {
  try {
    const planConfigs = await PlanConfig.find().sort({ plan: 1 });
    res.json({ planConfigs });
  } catch (error) {
    console.error('Get plan configs error:', error);
    res.status(500).json({ error: 'Failed to get plan configurations' });
  }
};

const checkTrialExpiry = async (req, res) => {
  try {
    const expiredTrials = await Subscription.find({
      status: 'trial',
      trialEndsAt: { $lt: new Date() }
    }).populate('restaurantId', 'name slug');
    
    // Update expired trials
    for (const subscription of expiredTrials) {
      subscription.status = 'suspended';
      await subscription.save();
    }
    
    res.json({ 
      message: `${expiredTrials.length} trial subscriptions expired`,
      expiredTrials: expiredTrials.map(s => s.restaurantId.name)
    });
  } catch (error) {
    console.error('Check trial expiry error:', error);
    res.status(500).json({ error: 'Failed to check trial expiry' });
  }
};

const updateRestaurantPlan = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { plan } = req.body;
    
    // Find existing subscription
    let subscription = await Subscription.findOne({ restaurantId });
    
    if (subscription) {
      // Update existing subscription
      const planConfig = await PlanConfig.findOne({ plan });
      if (!planConfig) {
        return res.status(400).json({ error: 'Invalid plan selected' });
      }
      
      subscription.plan = plan;
      subscription.price = planConfig.pricing.monthly;
      subscription.status = plan === 'trial' ? 'trial' : 'active';
      
      await subscription.save();
      
      // Also update the restaurant's subscriptionPlan field
      await Restaurant.findByIdAndUpdate(restaurantId, { subscriptionPlan: plan });
    } else {
      // Create new subscription
      const planConfig = await PlanConfig.findOne({ plan });
      if (!planConfig) {
        return res.status(400).json({ error: 'Invalid plan selected' });
      }
      
      subscription = new Subscription({
        restaurantId,
        plan,
        billing: 'monthly',
        price: planConfig.pricing.monthly,
        status: plan === 'trial' ? 'trial' : 'active'
      });
      
      await subscription.save();
      
      // Also update the restaurant's subscriptionPlan field
      await Restaurant.findByIdAndUpdate(restaurantId, { subscriptionPlan: plan });
    }
    
    await subscription.populate('restaurantId', 'name slug');
    
    res.json({ message: 'Plan updated successfully', subscription });
  } catch (error) {
    console.error('Update restaurant plan error:', error);
    res.status(500).json({ error: 'Failed to update plan' });
  }
};

module.exports = {
  createSubscription,
  getSubscriptions,
  getRestaurantSubscription,
  updateSubscription,
  updateSubscriptionLimits,
  cancelSubscription,
  reactivateSubscription,
  processPayment,
  updateUsage,
  getBillingReport,
  updatePlanConfig,
  getPlanConfigs,
  checkTrialExpiry,
  updateRestaurantPlan
};