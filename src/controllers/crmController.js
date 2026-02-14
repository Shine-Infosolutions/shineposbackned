const TenantModelFactory = require('../models/TenantModelFactory');

// Sync customer data from orders
const syncCustomersFromOrders = async (req, res) => {
  try {
    const restaurantSlug = req.user.restaurantSlug;
    const OrderModel = TenantModelFactory.getOrderModel(restaurantSlug);
    const CustomerModel = TenantModelFactory.getModel(restaurantSlug, 'Customer', require('../models/Customer'));
    
    const orders = await OrderModel.find({ customerPhone: { $exists: true, $ne: '' } });
    
    const customerMap = new Map();
    
    for (const order of orders) {
      if (!order.customerPhone) continue;
      
      const key = order.customerPhone;
      if (!customerMap.has(key)) {
        customerMap.set(key, {
          phone: order.customerPhone,
          name: order.customerName || 'Guest',
          totalOrders: 0,
          totalSpent: 0,
          lastOrderDate: order.createdAt
        });
      }
      
      const customer = customerMap.get(key);
      customer.totalOrders++;
      customer.totalSpent += order.totalAmount || 0;
      if (order.createdAt > customer.lastOrderDate) {
        customer.lastOrderDate = order.createdAt;
        customer.name = order.customerName || customer.name;
      }
    }
    
    let created = 0, updated = 0;
    
    for (const [phone, data] of customerMap) {
      const existing = await CustomerModel.findOne({ phone });
      if (existing) {
        existing.totalOrders = data.totalOrders;
        existing.totalSpent = data.totalSpent;
        existing.lastOrderDate = data.lastOrderDate;
        existing.name = data.name;
        await existing.save();
        updated++;
      } else {
        await CustomerModel.create(data);
        created++;
      }
    }
    
    res.json({ message: 'Customers synced successfully', created, updated, total: customerMap.size });
  } catch (error) {
    console.error('Sync customers error:', error);
    res.status(500).json({ error: 'Failed to sync customers' });
  }
};

// Customer endpoints
const getCustomers = async (req, res) => {
  try {
    const restaurantSlug = req.user.restaurantSlug;
    const CustomerModel = TenantModelFactory.getModel(restaurantSlug, 'Customer', require('../models/Customer'));
    
    const { phone } = req.query;
    const query = phone ? { phone } : {};
    
    const customers = await CustomerModel.find(query).sort({ createdAt: -1 });
    res.json(customers);
  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
};

const createCustomer = async (req, res) => {
  try {
    const { name, phone, email } = req.body;
    const restaurantSlug = req.user.restaurantSlug;
    const CustomerModel = TenantModelFactory.getModel(restaurantSlug, 'Customer', require('../models/Customer'));
    
    const customer = new CustomerModel({ name, phone, email });
    await customer.save();
    res.status(201).json(customer);
  } catch (error) {
    console.error('Create customer error:', error);
    res.status(500).json({ error: 'Failed to create customer' });
  }
};

const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email } = req.body;
    const restaurantSlug = req.user.restaurantSlug;
    const CustomerModel = TenantModelFactory.getModel(restaurantSlug, 'Customer', require('../models/Customer'));
    
    const customer = await CustomerModel.findById(id);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    
    customer.name = name;
    customer.phone = phone;
    customer.email = email || '';
    
    await customer.save();
    res.json(customer);
  } catch (error) {
    console.error('Update customer error:', error);
    res.status(500).json({ error: 'Failed to update customer' });
  }
};

const deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const restaurantSlug = req.user.restaurantSlug;
    const CustomerModel = TenantModelFactory.getModel(restaurantSlug, 'Customer', require('../models/Customer'));
    
    await CustomerModel.findByIdAndDelete(id);
    res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    console.error('Delete customer error:', error);
    res.status(500).json({ error: 'Failed to delete customer' });
  }
};

const getCustomerOrders = async (req, res) => {
  try {
    const { customerId } = req.params;
    const restaurantSlug = req.user.restaurantSlug;
    const OrderModel = TenantModelFactory.getOrderModel(restaurantSlug);
    
    const orders = await OrderModel.find({ customerId }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    console.error('Get customer orders error:', error);
    res.status(500).json({ error: 'Failed to fetch customer orders' });
  }
};

// Loyalty endpoints
const getLoyaltyCustomers = async (req, res) => {
  try {
    const restaurantSlug = req.user.restaurantSlug;
    const CustomerModel = TenantModelFactory.getModel(restaurantSlug, 'Customer', require('../models/Customer'));
    const customers = await CustomerModel.find().sort({ loyaltyPoints: -1 });
    res.json(customers);
  } catch (error) {
    console.error('Get loyalty customers error:', error);
    res.status(500).json({ error: 'Failed to fetch loyalty customers' });
  }
};

const getLoyaltySettings = async (req, res) => {
  try {
    const restaurantSlug = req.user.restaurantSlug;
    const LoyaltySettingsModel = TenantModelFactory.getModel(restaurantSlug, 'LoyaltySettings', require('../models/LoyaltySettings'));
    
    let settings = await LoyaltySettingsModel.findOne();
    if (!settings) {
      settings = new LoyaltySettingsModel({ pointsPerRupee: 1, redeemRate: 10 });
      await settings.save();
    }
    res.json(settings);
  } catch (error) {
    console.error('Get loyalty settings error:', error);
    res.status(500).json({ error: 'Failed to fetch loyalty settings' });
  }
};

const updateLoyaltySettings = async (req, res) => {
  try {
    const { pointsPerRupee, redeemRate } = req.body;
    const restaurantSlug = req.user.restaurantSlug;
    const LoyaltySettingsModel = TenantModelFactory.getModel(restaurantSlug, 'LoyaltySettings', require('../models/LoyaltySettings'));
    
    let settings = await LoyaltySettingsModel.findOne();
    if (!settings) {
      settings = new LoyaltySettingsModel({ pointsPerRupee, redeemRate });
    } else {
      settings.pointsPerRupee = pointsPerRupee;
      settings.redeemRate = redeemRate;
    }
    await settings.save();
    res.json(settings);
  } catch (error) {
    console.error('Update loyalty settings error:', error);
    res.status(500).json({ error: 'Failed to update loyalty settings' });
  }
};

// Campaign endpoints
const getCampaigns = async (req, res) => {
  try {
    const restaurantSlug = req.user.restaurantSlug;
    const CampaignModel = TenantModelFactory.getModel(restaurantSlug, 'Campaign', require('../models/Campaign'));
    const campaigns = await CampaignModel.find().sort({ createdAt: -1 });
    res.json(campaigns);
  } catch (error) {
    console.error('Get campaigns error:', error);
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
};

const createCampaign = async (req, res) => {
  try {
    const restaurantSlug = req.user.restaurantSlug;
    const CampaignModel = TenantModelFactory.getModel(restaurantSlug, 'Campaign', require('../models/Campaign'));
    
    const campaign = new CampaignModel(req.body);
    await campaign.save();
    res.status(201).json(campaign);
  } catch (error) {
    console.error('Create campaign error:', error);
    res.status(500).json({ error: 'Failed to create campaign' });
  }
};

const sendCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const restaurantSlug = req.user.restaurantSlug;
    const CampaignModel = TenantModelFactory.getModel(restaurantSlug, 'Campaign', require('../models/Campaign'));
    const CustomerModel = TenantModelFactory.getModel(restaurantSlug, 'Customer', require('../models/Customer'));
    
    const campaign = await CampaignModel.findById(id);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    
    let targetCustomers = [];
    if (campaign.targetAudience === 'all') {
      targetCustomers = await CustomerModel.find();
    } else if (campaign.targetAudience === 'vip') {
      targetCustomers = await CustomerModel.find({ totalSpent: { $gte: campaign.minSpent } });
    } else if (campaign.targetAudience === 'frequent') {
      targetCustomers = await CustomerModel.find({ totalOrders: { $gte: campaign.minOrders } });
    }
    
    campaign.status = 'sent';
    campaign.sentCount = targetCustomers.length;
    campaign.sentAt = new Date();
    await campaign.save();
    
    res.json({ message: 'Campaign sent successfully', sentCount: targetCustomers.length });
  } catch (error) {
    console.error('Send campaign error:', error);
    res.status(500).json({ error: 'Failed to send campaign' });
  }
};

// Review endpoints
const getReviews = async (req, res) => {
  try {
    const restaurantSlug = req.user.restaurantSlug;
    const ReviewModel = TenantModelFactory.getModel(restaurantSlug, 'Review', require('../models/Review'));
    const reviews = await ReviewModel.find().sort({ createdAt: -1 });
    res.json(reviews);
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
};

const updateReviewStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const restaurantSlug = req.user.restaurantSlug;
    const ReviewModel = TenantModelFactory.getModel(restaurantSlug, 'Review', require('../models/Review'));
    
    const review = await ReviewModel.findByIdAndUpdate(id, { status }, { new: true });
    if (!review) return res.status(404).json({ error: 'Review not found' });
    res.json(review);
  } catch (error) {
    console.error('Update review status error:', error);
    res.status(500).json({ error: 'Failed to update review status' });
  }
};

module.exports = {
  syncCustomersFromOrders,
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerOrders,
  getLoyaltyCustomers,
  getLoyaltySettings,
  updateLoyaltySettings,
  getCampaigns,
  createCampaign,
  sendCampaign,
  getReviews,
  updateReviewStatus
};
