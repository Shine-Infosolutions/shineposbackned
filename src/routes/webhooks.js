const express = require('express');
const router = express.Router();
const TenantModelFactory = require('../models/TenantModelFactory');

// Zomato Order History Webhook
router.post('/:restaurantId/orders/history', async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const orderData = req.body;

    console.log('Zomato Webhook Received:', {
      restaurantId,
      orderData
    });

    // Validate restaurant exists
    const Restaurant = require('../models/Restaurant');
    const restaurant = await Restaurant.findById(restaurantId);
    
    if (!restaurant) {
      return res.status(404).json({ 
        success: false, 
        error: 'Restaurant not found' 
      });
    }

    // Get Order model for this restaurant
    const OrderModel = TenantModelFactory.getOrderModel(restaurant.slug);

    // Create order from Zomato data
    const newOrder = new OrderModel({
      orderNumber: orderData.order_id || `ZOMATO-${Date.now()}`,
      customerName: orderData.customer_name || 'Zomato Customer',
      customerPhone: orderData.customer_phone || '',
      items: orderData.items?.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        itemTotal: item.quantity * item.price
      })) || [],
      totalAmount: orderData.total_amount || 0,
      status: orderData.status || 'PENDING',
      paymentMethod: orderData.payment_method || 'ONLINE',
      source: 'ZOMATO',
      metadata: {
        zomato_order_id: orderData.order_id,
        delivery_address: orderData.delivery_address,
        special_instructions: orderData.special_instructions
      }
    });

    await newOrder.save();

    res.status(200).json({
      success: true,
      message: 'Order received successfully',
      orderId: newOrder._id,
      orderNumber: newOrder.orderNumber
    });

  } catch (error) {
    console.error('Webhook Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process webhook',
      message: error.message
    });
  }
});

// Test endpoint to verify webhook is working
router.get('/:restaurantId/orders/history/test', (req, res) => {
  res.json({
    success: true,
    message: 'Webhook endpoint is active',
    restaurantId: req.params.restaurantId,
    endpoint: `POST /${req.params.restaurantId}/orders/history`,
    expectedPayload: {
      order_id: 'string',
      customer_name: 'string',
      customer_phone: 'string',
      items: [
        {
          name: 'string',
          quantity: 'number',
          price: 'number'
        }
      ],
      total_amount: 'number',
      status: 'PENDING | CONFIRMED | PREPARING | READY | DELIVERED',
      payment_method: 'CASH | ONLINE | CARD',
      delivery_address: 'string',
      special_instructions: 'string'
    }
  });
});

module.exports = router;
