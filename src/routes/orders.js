const express = require("express");
const { body, param } = require("express-validator");
const { activityLogger } = require('../middleware/activityLogger');
const {
  getOrders,
  createOrder,
  updateOrderStatus,
  updateOrderPriority,
} = require("../controllers/orderController");
const auth = require("../middleware/auth");
const checkSubscription = require("../middleware/checkSubscription");
const TenantModelFactory = require("../models/TenantModelFactory");

const router = express.Router();

/* =====================================================
   CREATE ORDER (STAFF)
===================================================== */
router.post(
  "/add/staff",
  auth(["RESTAURANT_ADMIN", "MANAGER", "CHEF", "WAITER", "CASHIER"]),
  checkSubscription,
  activityLogger('Order'),
  [
    body("items")
      .isArray({ min: 1 })
      .withMessage("Items are required"),

    body("items.*.menuId")
      .notEmpty()
      .withMessage("Menu ID is required"),

    body("items.*.quantity")
      .isInt({ min: 1 })
      .withMessage("Quantity must be at least 1"),

    body("customerName")
      .trim()
      .notEmpty()
      .withMessage("Customer name is required"),

    body("customerPhone")
      .optional()
      .isMobilePhone()
      .withMessage("Invalid phone number"),

    body("tableId")
      .optional()
      .isMongoId()
      .withMessage("Invalid table ID"),
  ],
  createOrder
);

/* =====================================================
   AUTH FOR ALL BELOW ROUTES
===================================================== */
router.use(
  auth(["RESTAURANT_ADMIN", "MANAGER", "CHEF", "WAITER", "CASHIER"]),
  checkSubscription
);

/* =====================================================
   GET ALL ORDERS
===================================================== */
router.get("/all/orders", activityLogger('Order'), getOrders);

/* =====================================================
   UPDATE ORDER STATUS
===================================================== */
router.patch(
  "/update/status/:id",
  activityLogger('Order'),
  [
    param("id")
      .isMongoId()
      .withMessage("Invalid order ID"),

    body("status")
      .isIn([
        "PENDING",
        "ORDER_ACCEPTED",
        "PREPARING",
        "READY",
        "SERVED",
        "COMPLETE",
        "CANCELLED",
      ])
      .withMessage("Invalid order status"),
  ],
  updateOrderStatus
);

/* =====================================================
   UPDATE ORDER PRIORITY
===================================================== */
router.patch(
  "/update/priority/:id",
  activityLogger('Order'),
  [
    param("id")
      .isMongoId()
      .withMessage("Invalid order ID"),

    body("priority")
      .isIn(["LOW", "NORMAL", "HIGH", "URGENT"])
      .withMessage("Invalid priority"),
  ],
  updateOrderPriority
);

module.exports = router;