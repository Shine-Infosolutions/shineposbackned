const express = require("express");
const { body, param } = require("express-validator");
const { activityLogger } = require("../middleware/activityLogger");
const {
  getOrders,
  getOrder,
  createOrder,
  addItemsToOrder,
  addExtraItemsToOrder,
  updateOrderStatus,
  updateItemStatus,
  updateExtraItemStatus,
  updateOrderPriority,
  processPayment,
  applyDiscount,
  getOrderHistoryWebhook,
  updateItemStatusWebhook,
} = require("../controllers/orderController");
const { fixExtraItemsField } = require("../controllers/fixController");
const auth = require("../middleware/auth");
const checkSubscription = require("../middleware/checkSubscription");
const TenantModelFactory = require("../models/TenantModelFactory");

const router = express.Router();
//CREATE ORDER (STAFF)
router.post(
  "/add/staff",
  auth(["RESTAURANT_ADMIN", "MANAGER", "CHEF", "WAITER", "CASHIER"]),
  checkSubscription,
  activityLogger("Order"),
  [
    body("items").isArray({ min: 1 }).withMessage("Items are required"),

    body("items.*.menuId").notEmpty().withMessage("Menu ID is required"),

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

    body("tableId").optional().isMongoId().withMessage("Invalid table ID"),
  ],
  createOrder,
);

/* =====================================================
   AUTH FOR ALL BELOW ROUTES
===================================================== */
router.use(
  auth(["RESTAURANT_ADMIN", "MANAGER", "CHEF", "WAITER", "CASHIER"]),
  checkSubscription,
);

/* =====================================================
   ADD ITEMS TO EXISTING ORDER
===================================================== */
router.post(
  "/add-items/:orderId",
  activityLogger("Order"),
  [
    param("orderId").isMongoId().withMessage("Invalid order ID"),
    body("items").isArray({ min: 1 }).withMessage("Items are required"),
    body("items.*.menuId").notEmpty().withMessage("Menu ID is required"),
    body("items.*.quantity")
      .isInt({ min: 1 })
      .withMessage("Quantity must be at least 1"),
  ],
  addItemsToOrder,
);

/* =====================================================
   ADD EXTRA ITEMS TO EXISTING ORDER
===================================================== */
router.post(
  "/add-extra-items/:orderId",
  activityLogger("Order"),
  [
    param("orderId").isMongoId().withMessage("Invalid order ID"),
    body("extraItems").isArray({ min: 1 }).withMessage("Extra items are required"),
    body("extraItems.*.menuId").notEmpty().withMessage("Menu ID is required"),
    body("extraItems.*.quantity")
      .isInt({ min: 1 })
      .withMessage("Quantity must be at least 1"),
  ],
  addExtraItemsToOrder,
);

/* =====================================================
   UPDATE EXTRA ITEM STATUS
===================================================== */
router.patch(
  "/update/extra-item-status/:orderId/:itemIndex",
  activityLogger("Order"),
  [
    param("orderId").isMongoId().withMessage("Invalid order ID"),
    param("itemIndex").isInt({ min: 0 }).withMessage("Invalid item index"),
    body("status")
      .isIn(["PENDING", "PREPARING", "READY", "SERVED"])
      .withMessage("Invalid extra item status"),
  ],
  updateExtraItemStatus,
);

/* =====================================================
   UPDATE ITEM STATUS
===================================================== */
router.patch(
  "/update/item-status/:orderId/:itemIndex",
  activityLogger("Order"),
  [
    param("orderId").isMongoId().withMessage("Invalid order ID"),
    param("itemIndex").isInt({ min: 0 }).withMessage("Invalid item index"),
    body("status")
      .isIn(["PENDING", "PREPARING", "READY", "SERVED"])
      .withMessage("Invalid item status"),
  ],
  updateItemStatus,
);

/* =====================================================
   FIX EXTRA ITEMS FIELD
===================================================== */
router.patch(
  "/fix-extra-items/:orderId",
  activityLogger("Order"),
  [
    param("orderId").isMongoId().withMessage("Invalid order ID"),
  ],
  fixExtraItemsField,
);

/* =====================================================
   GET SINGLE ORDER
===================================================== */
router.get(
  "/get/:orderId",
  activityLogger("Order"),
  [
    param("orderId").isMongoId().withMessage("Invalid order ID"),
  ],
  getOrder,
);

/* =====================================================
   GET ALL ORDERS
===================================================== */
router.get("/all/orders", activityLogger("Order"), getOrders);

/* =====================================================
   UPDATE ORDER STATUS
===================================================== */
router.patch(
  "/update/status/:id",
  activityLogger("Order"),
  [
    param("id").isMongoId().withMessage("Invalid order ID"),

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
  updateOrderStatus,
);

/*=====================================================
   UPDATE ORDER PRIORITY
======================================================*/
router.patch(
  "/update/priority/:id",
  activityLogger("Order"),
  [
    param("id").isMongoId().withMessage("Invalid order ID"),

    body("priority")
      .isIn(["LOW", "NORMAL", "HIGH", "URGENT"])
      .withMessage("Invalid priority"),
  ],
  updateOrderPriority,
);

/*=====================================================
   APPLY DISCOUNT
======================================================*/
router.patch(
  "/discount/:orderId",
  activityLogger("Order"),
  [
    param("orderId").isMongoId().withMessage("Invalid order ID"),
    body("percentage").isFloat({ min: 0.01, max: 100 }).withMessage("Percentage must be between 0.01 and 100"),
    body("reason").optional().isString().withMessage("Reason must be a string"),
  ],
  applyDiscount,
);

/*=====================================================
   PROCESS PAYMENT
======================================================*/
router.patch(
  "/payment/:id",
  activityLogger("Payment"),
  [
    param("id").isMongoId().withMessage("Invalid order ID"),
    body("method").isIn(["CASH", "CARD", "UPI"]).withMessage("Invalid payment method"),
    body("amount").isFloat({ min: 0 }).withMessage("Invalid amount"),
  ],
  processPayment,
);

const router2 = express.Router();
router2.get("/webhook/:restaurant_id/history", getOrderHistoryWebhook);
router2.post(
  "/webhook/:restaurant_id/items/status",
  [
    body("orderId").isMongoId().withMessage("Invalid order ID"),
    body("itemIndex").isInt({ min: 0 }).withMessage("Invalid item index"),
    body("status").isIn(["PENDING", "PREPARING", "READY", "SERVED"]).withMessage("Invalid status"),
  ],
  updateItemStatusWebhook
);

module.exports = router;
module.exports.webhookRouter = router2;
