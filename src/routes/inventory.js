const express = require("express");
const { body } = require("express-validator");
const { activityLogger } = require("../middleware/activityLogger");
const {
  createInventoryItem,
  getInventory,
  updateInventoryItem,
  restockItem,
  getLowStockItems,
  deleteInventoryItem,
  // Smart Inventory
  createRecipe,
  getRecipes,
  processOrder,
  createWastage,
  getWastage,
  createVendor,
  getVendors,
  createVendorPrice,
  getVendorPrices,
  getSalesData,
  // Purchase Orders
  createPurchaseOrder,
  getPurchaseOrders,
  updatePurchaseOrderStatus,
  getStockLogs
} = require("../controllers/inventoryController");
const auth = require("../middleware/auth");
const tenantMiddleware = require("../middleware/tenant");

const router = express.Router();

router.get(
  "/all/inventory/items",
  auth(["RESTAURANT_ADMIN", "MANAGER", "CHEF"]),
  tenantMiddleware,
  activityLogger("Inventory"),
  getInventory
);

router.get(
  "/all/low-stock",
  auth(["RESTAURANT_ADMIN", "MANAGER", "CHEF"]),
  tenantMiddleware,
  activityLogger("Inventory"),
  getLowStockItems
);

router.post(
  "/add",
  auth(["RESTAURANT_ADMIN"]),
  tenantMiddleware,
  activityLogger("Inventory"),
  [
    body("name").trim().isLength({ min: 1 }).withMessage("Name is required"),
    body("category")
      .isIn(["ingredient", "beverage", "packaging", "other"])
      .withMessage("Valid category is required"),
    body("currentStock")
      .isNumeric()
      .withMessage("Current stock must be a number"),
    body("minStock").isNumeric().withMessage("Min stock must be a number"),
    body("unit")
      .isIn(["kg", "g", "l", "ml", "pieces", "boxes"])
      .withMessage("Valid unit is required"),
    body("costPerUnit")
      .isNumeric()
      .withMessage("Cost per unit must be a number"),
  ],
  createInventoryItem
);

router.put(
  "/update/item/:id",
  auth(["RESTAURANT_ADMIN"]),
  tenantMiddleware,
  activityLogger("Inventory"),
  updateInventoryItem
);

router.patch(
  "/update/restock/:id",
  auth(["RESTAURANT_ADMIN", "MANAGER"]),
  tenantMiddleware,
  activityLogger("Inventory"),
  [body("quantity").isNumeric().withMessage("Quantity must be a number")],
  restockItem
);

router.delete(
  "/delete/:id",
  auth(["RESTAURANT_ADMIN"]),
  tenantMiddleware,
  deleteInventoryItem
);

// Smart Inventory Routes

// Recipe Management
router.get("/recipes", auth(["RESTAURANT_ADMIN", "STAFF"]), tenantMiddleware, getRecipes);
router.post("/recipes", auth(["RESTAURANT_ADMIN"]), tenantMiddleware, createRecipe);
router.post("/process-order", auth(["RESTAURANT_ADMIN", "STAFF"]), tenantMiddleware, processOrder);

// Wastage Tracking
router.get("/wastage", auth(["RESTAURANT_ADMIN", "STAFF"]), tenantMiddleware, getWastage);
router.post("/wastage", auth(["RESTAURANT_ADMIN", "STAFF"]), tenantMiddleware, createWastage);

// Vendor Management
router.get("/vendors", auth(["RESTAURANT_ADMIN"]), tenantMiddleware, getVendors);
router.post("/vendors", auth(["RESTAURANT_ADMIN"]), tenantMiddleware, createVendor);
router.get("/vendor-prices", auth(["RESTAURANT_ADMIN"]), tenantMiddleware, getVendorPrices);
router.post("/vendor-prices", auth(["RESTAURANT_ADMIN"]), tenantMiddleware, createVendorPrice);

// Analytics
router.get("/sales-data", auth(["RESTAURANT_ADMIN", "STAFF"]), tenantMiddleware, getSalesData);

// Purchase Orders
router.get("/purchase-orders", auth(["RESTAURANT_ADMIN"]), tenantMiddleware, getPurchaseOrders);
router.post("/purchase-orders", auth(["RESTAURANT_ADMIN"]), tenantMiddleware, createPurchaseOrder);
router.patch("/purchase-orders/:id", auth(["RESTAURANT_ADMIN"]), tenantMiddleware, updatePurchaseOrderStatus);

// Stock Logs
router.get("/stock-logs", auth(["RESTAURANT_ADMIN", "MANAGER"]), tenantMiddleware, getStockLogs);

module.exports = router;
