const express = require('express');
const { activityLogger } = require('../middleware/activityLogger');
const {
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
} = require('../controllers/crmController');
const auth = require('../middleware/auth');
const checkSubscription = require('../middleware/checkSubscription');
const tenantMiddleware = require('../middleware/tenant');

const router = express.Router();

// Sync route
router.post('/customers/sync', auth(['RESTAURANT_ADMIN']), checkSubscription, tenantMiddleware, activityLogger('CRM'), syncCustomersFromOrders);

// Loyalty routes
router.get('/loyalty/settings', auth(['RESTAURANT_ADMIN', 'MANAGER']), checkSubscription, tenantMiddleware, activityLogger('CRM'), getLoyaltySettings);
router.put('/loyalty/settings', auth(['RESTAURANT_ADMIN']), checkSubscription, tenantMiddleware, activityLogger('CRM'), updateLoyaltySettings);
router.get('/customers/loyalty', auth(['RESTAURANT_ADMIN', 'MANAGER']), checkSubscription, tenantMiddleware, activityLogger('CRM'), getLoyaltyCustomers);

// Customer routes
router.get('/customers/:customerId/orders', auth(['RESTAURANT_ADMIN', 'MANAGER']), checkSubscription, tenantMiddleware, activityLogger('CRM'), getCustomerOrders);
router.get('/customers', auth(['RESTAURANT_ADMIN', 'MANAGER']), checkSubscription, tenantMiddleware, activityLogger('CRM'), getCustomers);
router.post('/customers', auth(['RESTAURANT_ADMIN', 'MANAGER']), checkSubscription, tenantMiddleware, activityLogger('CRM'), createCustomer);
router.put('/customers/:id', auth(['RESTAURANT_ADMIN', 'MANAGER']), checkSubscription, tenantMiddleware, activityLogger('CRM'), updateCustomer);
router.delete('/customers/:id', auth(['RESTAURANT_ADMIN', 'MANAGER']), checkSubscription, tenantMiddleware, activityLogger('CRM'), deleteCustomer);

// Campaign routes
router.get('/campaigns', auth(['RESTAURANT_ADMIN', 'MANAGER']), checkSubscription, tenantMiddleware, activityLogger('CRM'), getCampaigns);
router.post('/campaigns', auth(['RESTAURANT_ADMIN', 'MANAGER']), checkSubscription, tenantMiddleware, activityLogger('CRM'), createCampaign);
router.post('/campaigns/:id/send', auth(['RESTAURANT_ADMIN', 'MANAGER']), checkSubscription, tenantMiddleware, activityLogger('CRM'), sendCampaign);

// Review routes
router.get('/reviews', auth(['RESTAURANT_ADMIN', 'MANAGER']), checkSubscription, tenantMiddleware, activityLogger('CRM'), getReviews);
router.patch('/reviews/:id', auth(['RESTAURANT_ADMIN', 'MANAGER']), checkSubscription, tenantMiddleware, activityLogger('CRM'), updateReviewStatus);

module.exports = router;
