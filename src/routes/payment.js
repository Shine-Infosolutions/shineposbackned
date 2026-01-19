const express = require('express');
const { body, param } = require('express-validator');
const { activityLogger } = require('../middleware/activityLogger');
const { processPayment } = require('../controllers/orderController');
const auth = require('../middleware/auth');

const router = express.Router();

/* =====================================================
   PROCESS PAYMENT FOR ORDER
===================================================== */
router.patch(
  "/order/:id",
  auth(["RESTAURANT_ADMIN", "MANAGER", "CASHIER"]),
  activityLogger('Payment'),
  [
    param("id")
      .isMongoId()
      .withMessage("Invalid order ID"),

    body("method")
      .isIn(["CASH", "CARD", "UPI", "ONLINE"])
      .withMessage("Invalid payment method"),

    body("amount")
      .isFloat({ min: 0 })
      .withMessage("Invalid payment amount"),

    body("transactionId")
      .optional()
      .isString(),
  ],
  processPayment
);

module.exports = router;