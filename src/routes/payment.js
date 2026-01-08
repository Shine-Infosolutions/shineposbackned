// const express = require('express');
// const router = express.Router();
// const TenantModelFactory = require('../models/TenantModelFactory');
// const auth = require('../middleware/auth');

// // Process payment for an order
// router.post('/orders/:orderId/payments', auth(['CASHIER', 'RESTAURANT_ADMIN', 'MANAGER']), async (req, res) => {
//   try {
//     const { orderId } = req.params;
//     const { paymentMethod, amount } = req.body;
//     const OrderModel = req.tenantModels.Order;

//     const order = await OrderModel.findById(orderId);
//     if (!order) {
//       return res.status(404).json({ error: 'Order not found' });
//     }

//     // Simulate payment processing
//     const paymentResult = {
//       success: Math.random() > 0.05, // 95% success rate
//       transactionId: 'txn_' + Date.now(),
//       paymentMethod,
//       amount
//     };

//     if (paymentResult.success) {
//       order.status = 'PAID';
//       order.paymentDetails = {
//         method: paymentMethod,
//         amount,
//         transactionId: paymentResult.transactionId,
//         paidAt: new Date()
//       };
//       await order.save();
//     }

//     res.json({
//       success: paymentResult.success,
//       message: paymentResult.success ? 'Payment processed successfully' : 'Payment failed',
//       order: paymentResult.success ? order : null,
//       transactionId: paymentResult.transactionId
//     });
//   } catch (error) {
//     console.error('Payment processing error:', error);
//     res.status(500).json({ error: 'Failed to process payment' });
//   }
// });

// module.exports = router;