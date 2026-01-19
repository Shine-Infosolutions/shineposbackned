const express = require("express");
const { body, param, query } = require("express-validator");
const { activityLogger } = require('../middleware/activityLogger');
const {
  getTables,
  createTable,
  updateTableStatus,
  getBookings,
  createBooking,
  updateBookingStatus,
  getAvailableTables,
  orderFromTable,
  getMenuForTable,
} = require("../controllers/tableBookingController");
const auth = require("../middleware/auth");

const router = express.Router();

/* =====================================================
   AUTH FOR ALL ROUTES
===================================================== */
router.use(
  auth(["RESTAURANT_ADMIN", "MANAGER", "WAITER", "CASHIER"])
);

/* =====================================================
   TABLE MANAGEMENT
===================================================== */

// Get all tables
router.get("/tables", activityLogger('Table'), getTables);

// Create table
router.post(
  "/tables",
  activityLogger('Table'),
  [
    body("tableNumber")
      .trim()
      .notEmpty()
      .withMessage("Table number is required"),

    body("capacity")
      .isInt({ min: 1 })
      .withMessage("Capacity must be at least 1"),

    body("location")
      .optional()
      .isIn(["INDOOR"])
      .withMessage("Location must be INDOOR"),
  ],
  createTable
);

// Update table status
router.patch(
  "/tables/:id/status",
  activityLogger('Table'),
  [
    param("id")
      .isMongoId()
      .withMessage("Invalid table ID"),

    body("status")
      .isIn(["AVAILABLE", "OCCUPIED", "RESERVED", "MAINTENANCE"])
      .withMessage("Invalid table status"),
  ],
  updateTableStatus
);

/* =====================================================
   BOOKING MANAGEMENT
===================================================== */

// Get all bookings
router.get(
  "/bookings",
  activityLogger('Booking'),
  [
    query("date")
      .optional()
      .isISO8601()
      .withMessage("Invalid date format"),

    query("status")
      .optional()
      .isIn(["PENDING", "CONFIRMED", "SEATED", "COMPLETED", "CANCELLED", "NO_SHOW"])
      .withMessage("Invalid booking status"),
  ],
  getBookings
);

// Create booking
router.post(
  "/bookings",
  activityLogger('Booking'),
  [
    body("tableId")
      .isMongoId()
      .withMessage("Valid table ID is required"),

    body("customerName")
      .trim()
      .notEmpty()
      .withMessage("Customer name is required"),

    body("customerPhone")
      .trim()
      .notEmpty()
      .withMessage("Customer phone is required"),

    body("customerEmail")
      .optional()
      .isEmail()
      .withMessage("Invalid email format"),

    body("partySize")
      .isInt({ min: 1 })
      .withMessage("Party size must be at least 1"),

    body("bookingDate")
      .isISO8601()
      .withMessage("Valid booking date is required"),

    body("bookingTime")
      .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage("Valid booking time is required (HH:MM format)"),

    body("duration")
      .optional()
      .isInt({ min: 30, max: 480 })
      .withMessage("Duration must be between 30 and 480 minutes"),

    body("specialRequests")
      .optional()
      .trim(),
  ],
  createBooking
);

// Update booking status
router.patch(
  "/bookings/:id/status",
  activityLogger('Booking'),
  [
    param("id")
      .isMongoId()
      .withMessage("Invalid booking ID"),

    body("status")
      .isIn(["PENDING", "CONFIRMED", "SEATED", "COMPLETED", "CANCELLED", "NO_SHOW"])
      .withMessage("Invalid booking status"),
  ],
  updateBookingStatus
);

// Get available tables
router.get(
  "/available-tables",
  [
    query("date")
      .notEmpty()
      .isISO8601()
      .withMessage("Valid date is required"),

    query("time")
      .notEmpty()
      .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage("Valid time is required (HH:MM format)"),

    query("partySize")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Party size must be at least 1"),

    query("duration")
      .optional()
      .isInt({ min: 30, max: 480 })
      .withMessage("Duration must be between 30 and 480 minutes"),
  ],
  getAvailableTables
);

// Get menu for table
router.get(
  "/tables/:tableId/menu",
  [
    param("tableId")
      .isMongoId()
      .withMessage("Invalid table ID"),
  ],
  getMenuForTable
);

// Order food from table
router.post(
  "/tables/:tableId/order",
  activityLogger('Order'),
  [
    param("tableId")
      .isMongoId()
      .withMessage("Invalid table ID"),

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
      .optional()
      .trim(),
  ],
  orderFromTable
);

module.exports = router;