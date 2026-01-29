const express = require('express');
const router = express.Router();
const TenantModelFactory = require('../models/TenantModelFactory');

// Dyno pushes Zomato orders to this endpoint
router.post('/:restaurantId/orders/history', async (req, res) => {
  try {
    const zomatoResId = req.params.restaurantId; // This is Zomato res_id
    const orders = req.body; // Array of orders from Dyno

    console.log('Dyno Webhook - Received orders for res_id:', zomatoResId);
    console.log('Full request body:', JSON.stringify(orders, null, 2));

    // Find restaurant by Zomato res_id stored in metadata
    const Restaurant = require('../models/Restaurant');
    const restaurant = await Restaurant.findOne({ 'metadata.zomato_res_id': zomatoResId });
    
    if (!restaurant) {
      return res.status(404).json({ 
        success: false, 
        error: 'Restaurant not found',
        hint: 'Map Zomato res_id to restaurant in metadata'
      });
    }

    // Get Order model for this restaurant
    const OrderModel = TenantModelFactory.getOrderModel(restaurant.slug);

    // Process orders (handle both single order and array)
    const orderArray = Array.isArray(orders) ? orders : [orders];
    const createdOrders = [];

    for (const orderData of orderArray) {
      // Check if order already exists
      const existingOrder = await OrderModel.findOne({ 
        'metadata.zomato_order_id': orderData.order_id 
      });

      if (existingOrder) {
        console.log('Order already exists:', orderData.order_id);
        continue;
      }

      // Create new order
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
          res_id: zomatoResId,
          delivery_address: orderData.delivery_address,
          special_instructions: orderData.special_instructions,
          raw_data: orderData
        }
      });

      await newOrder.save();
      createdOrders.push(newOrder);
    }

    res.status(200).json({
      success: true,
      message: 'Orders received successfully',
      restaurant: restaurant.name,
      ordersProcessed: orderArray.length,
      ordersCreated: createdOrders.length,
      orderIds: createdOrders.map(o => o.orderNumber)
    });

  } catch (error) {
    console.error('Dyno Webhook Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process orders',
      message: error.message
    });
  }
});

// Test endpoint
router.get('/:restaurantId/orders/history', (req, res) => {
  res.json({
    success: true,
    message: 'Dyno webhook endpoint is active',
    zomatoResId: req.params.restaurantId,
    method: 'POST - Dyno pushes orders here',
    endpoint: `POST /api/webhooks/${req.params.restaurantId}/orders/history`
  });
});

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
