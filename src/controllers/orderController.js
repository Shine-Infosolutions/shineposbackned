const { validationResult } = require("express-validator");
const TenantModelFactory = require("../models/TenantModelFactory");
const Restaurant = require("../models/Restaurant");
const ModuleConfig = require('../models/ModuleConfig');
const Discount = require('../models/Discount');
const DiscountUsage = require('../models/DiscountUsage');
const Customer = require('../models/Customer');
const LoyaltySettings = require('../models/LoyaltySettings');
const kotPrinter = require("../utils/kotPrinter");
const { prepareKOTData } = require("../utils/kotDataHelper");
const { deductInventoryForItems, restockInventoryForItems } = require('./inventoryController');

// Cache restaurant + moduleConfig lookups for 60s
const restaurantCache = new Map();
const moduleConfigCache = new Map();
const CACHE_TTL = 60 * 1000;

const getRestaurant = async (slug) => {
  const cached = restaurantCache.get(slug);
  if (cached && Date.now() < cached.expiresAt) return cached.data;
  const restaurant = await Restaurant.findOne({ slug }).lean();
  if (restaurant) restaurantCache.set(slug, { data: restaurant, expiresAt: Date.now() + CACHE_TTL });
  return restaurant;
};

const getModuleConfig = async (restaurantId) => {
  const key = restaurantId.toString();
  const cached = moduleConfigCache.get(key);
  if (cached && Date.now() < cached.expiresAt) return cached.data;
  const config = await ModuleConfig.findOne({ restaurantId }).lean();
  moduleConfigCache.set(key, { data: config, expiresAt: Date.now() + CACHE_TTL });
  return config;
};

/* =====================================================
   ADD ITEMS TO EXISTING ORDER
===================================================== */
const addItemsToOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { items } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ error: "Items are required" });
    }

    const restaurantSlug = req.user?.restaurantSlug;
    if (!restaurantSlug) {
      return res.status(400).json({ error: "Restaurant slug not found" });
    }

    const OrderModel = TenantModelFactory.getOrderModel(restaurantSlug);
    const KOTModel = TenantModelFactory.getKOTModel(restaurantSlug);
    const MenuModel = TenantModelFactory.getMenuItemModel(restaurantSlug);
    const VariationModel = TenantModelFactory.getVariationModel(restaurantSlug);
    const AddonModel = TenantModelFactory.getAddonModel(restaurantSlug);

    // Find existing order
    const existingOrder = await OrderModel.findById(orderId);
    if (!existingOrder) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Find existing KOT for this order
    let existingKOT = await KOTModel.findOne({ orderId });
    if (!existingKOT) {
      return res.status(404).json({ error: "KOT not found for this order" });
    }

    // Batch fetch all menu items, variations, addons in 3 queries
    const menuIds2 = [...new Set(items.map(i => i.menuId))];
    const variationIds2 = [...new Set(items.flatMap(i => i.variation?.variationId ? [i.variation.variationId] : []))];
    const addonIds2 = [...new Set(items.flatMap(i => (i.addons || []).map(a => a.addonId).filter(Boolean)))];

    const [menuItemsArr2, variationsArr2, addonsArr2] = await Promise.all([
      MenuModel.find({ _id: { $in: menuIds2 } }).lean(),
      variationIds2.length ? VariationModel.find({ _id: { $in: variationIds2 } }).lean() : [],
      addonIds2.length ? AddonModel.find({ _id: { $in: addonIds2 } }).lean() : []
    ]);
    const menuMap2 = Object.fromEntries(menuItemsArr2.map(m => [m._id.toString(), m]));
    const variationMap2 = Object.fromEntries(variationsArr2.map(v => [v._id.toString(), v]));
    const addonMap2 = Object.fromEntries(addonsArr2.map(a => [a._id.toString(), a]));

    let totalAmount = 0;
    const newOrderItems = [];
    const newKOTItems = [];

    for (const item of items) {
      const { menuId, quantity, variation, addons } = item;
      if (!menuId || !quantity) return res.status(400).json({ error: 'Invalid item data' });

      const menuItem = menuMap2[menuId?.toString()];
      if (!menuItem) return res.status(400).json({ error: 'Menu item not available' });

      let finalVariation = null, variationPrice = 0;
      if (variation?.variationId) {
        const v = variationMap2[variation.variationId.toString()];
        if (v) { variationPrice = v.price; finalVariation = { variationId: v._id, name: v.name, price: v.price }; }
      }

      let addonsTotal = 0;
      const finalAddons = [];
      for (const addon of (addons || [])) {
        if (addon.addonId) {
          const a = addonMap2[addon.addonId.toString()];
          if (a) { addonsTotal += a.price; finalAddons.push({ addonId: a._id, name: a.name, price: a.price }); }
        }
      }

      const itemTotal = (variationPrice + addonsTotal) * quantity;
      totalAmount += itemTotal;
      newOrderItems.push({ menuId: menuItem._id, name: menuItem.itemName, basePrice: 0, quantity, variation: finalVariation, addons: finalAddons, itemTotal, status: 'PENDING', timeToPrepare: menuItem.timeToPrepare || 15, startedAt: null, readyAt: null, actualPrepTime: null });
      newKOTItems.push({ menuId: menuItem._id, name: menuItem.itemName, quantity, variation: finalVariation, addons: finalAddons, status: 'PENDING', timeToPrepare: menuItem.timeToPrepare || 15 });
    }

    // Add new items to existing order as extra items
    existingOrder.extraItems.push(...newOrderItems);
    existingOrder.totalAmount += totalAmount;
    
    // Reset order status if it was DELIVERED or READY
    if (existingOrder.status === 'DELIVERED' || existingOrder.status === 'READY') {
      existingOrder.status = 'PREPARING';
    }
    
    await existingOrder.save();

    // Add new items to existing KOT (reuse same KOT)
    existingKOT.extraItems.push(...newKOTItems);
    
    // Reset KOT status if needed
    if (existingKOT.status === 'DELIVERED' || existingKOT.status === 'READY') {
      existingKOT.status = 'PREPARING';
    }
    
    await existingKOT.save();

    res.json({
      message: "Items added to existing order successfully",
      order: existingOrder,
      kot: existingKOT
    });
  } catch (error) {
    console.error("Add items to order error:", error);
    res.status(500).json({
      error: "Failed to add items to order",
      details: error.message,
    });
  }
};

/* =====================================================
   CREATE ORDER
===================================================== */
const createOrder = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const restaurantSlug =
      req.params.restaurantSlug || req.user?.restaurantSlug;

    if (!restaurantSlug) {
      return res.status(400).json({ error: "Restaurant slug not found" });
    }

    const { items, customerName, customerPhone, tableId } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ error: "Items are required" });
    }

    const restaurant = await getRestaurant(restaurantSlug);
    if (!restaurant) return res.status(404).json({ error: "Restaurant not found" });
    if (!restaurant.isActive) return res.status(403).json({ error: "Restaurant is temporarily not accepting orders" });

    const MenuModel = req.tenantModels?.MenuItem || TenantModelFactory.getMenuItemModel(restaurantSlug);
    const VariationModel = TenantModelFactory.getVariationModel(restaurantSlug);
    const AddonModel = TenantModelFactory.getAddonModel(restaurantSlug);

    // Batch fetch all menu items, variations, addons in 3 queries instead of N queries
    const menuIds = [...new Set(items.map(i => i.menuId))];
    const variationIds = [...new Set(items.flatMap(i => i.variation?.variationId ? [i.variation.variationId] : []))];
    const addonIds = [...new Set(items.flatMap(i => (i.addons || []).map(a => a.addonId).filter(Boolean)))];

    const [menuItemsArr, variationsArr, addonsArr] = await Promise.all([
      MenuModel.find({ _id: { $in: menuIds } }).lean(),
      variationIds.length ? VariationModel.find({ _id: { $in: variationIds } }).lean() : [],
      addonIds.length ? AddonModel.find({ _id: { $in: addonIds } }).lean() : []
    ]);

    const menuMap = Object.fromEntries(menuItemsArr.map(m => [m._id.toString(), m]));
    const variationMap = Object.fromEntries(variationsArr.map(v => [v._id.toString(), v]));
    const addonMap = Object.fromEntries(addonsArr.map(a => [a._id.toString(), a]));

    let totalAmount = 0;
    const orderItems = [];

    for (const item of items) {
      const { menuId, quantity, variation, addons, timeToPrepare } = item;
      if (!menuId || !quantity) return res.status(400).json({ error: "Invalid item data" });

      const menuItem = menuMap[menuId?.toString()];
      if (!menuItem || menuItem.status !== 'active') return res.status(400).json({ error: "Menu item not available" });

      let finalVariation = null;
      let variationPrice = 0;
      if (variation?.variationId) {
        const v = variationMap[variation.variationId.toString()];
        if (v) { variationPrice = v.price; finalVariation = { variationId: v._id, name: v.name, price: v.price }; }
      }

      let addonsTotal = 0;
      const finalAddons = [];
      for (const addon of (addons || [])) {
        if (addon.addonId) {
          const a = addonMap[addon.addonId.toString()];
          if (a) { addonsTotal += a.price; finalAddons.push({ addonId: a._id, name: a.name, price: a.price }); }
        }
      }

      const itemTotal = (variationPrice + addonsTotal) * quantity;
      totalAmount += itemTotal;
      orderItems.push({
        menuId: menuItem._id, name: menuItem.itemName, basePrice: 0,
        quantity, variation: finalVariation, addons: finalAddons, itemTotal,
        status: "PENDING", timeToPrepare: timeToPrepare || menuItem.timeToPrepare || 15,
        startedAt: null, readyAt: null, actualPrepTime: null
      });
    }

    const orderNumber = `ORD-${await TenantModelFactory.getNextSequence(restaurantSlug, 'order')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const OrderModel =
      req.tenantModels?.Order ||
      TenantModelFactory.getOrderModel(restaurantSlug);

    // Calculate discount if provided
    const { discount } = req.body;
    
    let subtotal = totalAmount;
    let discountAmount = 0;
    let afterDiscount = totalAmount;

    if (discount && discount.percentage > 0) {
      discountAmount = (subtotal * discount.percentage) / 100;
      afterDiscount = subtotal - discountAmount;
    }

    const moduleConfig = await getModuleConfig(restaurant._id);
    const isGSTEnabled = moduleConfig?.modules?.gst?.enabled ?? true;

    // Calculate GST and SGST only if GST module is enabled
    let gstAmount = 0;
    let sgstAmount = 0;
    if (isGSTEnabled) {
      gstAmount = (afterDiscount * 2.5) / 100;
      sgstAmount = (afterDiscount * 2.5) / 100;
    }
    const finalTotal = afterDiscount + gstAmount + sgstAmount;

    // Handle table assignment if provided
    let tableNumber = null;
    let mergedTables = [];
    if (tableId) {
      const TableModel = TenantModelFactory.getTableModel(restaurantSlug);
      
      const table = await TableModel.findById(tableId);
      
      if (table) {
        tableNumber = table.tableNumber;
        
        if (table.mergedWith && table.mergedWith.length > 0) {
          mergedTables = table.mergedWith;
        }
        
        table.status = "OCCUPIED";
        await table.save();
      }
    }

    const orderData = {
      orderNumber,
      items: orderItems,
      subtotal,
      gst: gstAmount,
      sgst: sgstAmount,
      totalAmount: finalTotal,
      customerName,
      customerPhone: customerPhone || "",
      tableId: tableId || null,
      tableNumber: tableNumber,
      mergedTables: mergedTables.length > 0 ? mergedTables : undefined
    };

    if (discount && discount.percentage > 0) {
      orderData.discount = {
        percentage: discount.percentage,
        amount: discountAmount,
        reason: discount.reason || "",
        appliedBy: req.user?.id || null,
      };
    }

    const order = new OrderModel(orderData);
    const savedOrder = await order.save();

    // Auto-deduct inventory based on recipes
    deductInventoryForItems(restaurantSlug, orderItems).catch(err =>
      console.error('Inventory deduction failed:', err)
    );

    // Note: Loyalty points will be credited when payment is processed

    // Auto-create KOT when order is created
    try {
      const KOTModel = TenantModelFactory.getKOTModel(restaurantSlug);

      const kotItems = orderItems.map(item => ({
        menuId: item.menuId,
        name: item.name,
        quantity: item.quantity,
        variation: item.variation,
        addons: item.addons,
        status: "PENDING",
        timeToPrepare: item.timeToPrepare || savedOrder.items.find(i => i.menuId.toString() === item.menuId.toString())?.timeToPrepare || 15,
        startedAt: null,
        readyAt: null,
        actualPrepTime: null
      }));

      // Retry up to 3 times on duplicate kotNumber (counter out-of-sync guard)
      let kotSaved = false;
      for (let attempt = 0; attempt < 3 && !kotSaved; attempt++) {
        const kotSeq = await TenantModelFactory.getNextSequence(restaurantSlug, 'kot');
        const kot = new KOTModel({
          kotNumber: `KOT${String(kotSeq).padStart(6, '0')}`,
          orderId: savedOrder._id,
          orderNumber: savedOrder.orderNumber,
          items: kotItems,
          customerName: savedOrder.customerName,
          tableNumber: savedOrder.tableNumber
        });
        try {
          await kot.save();
          kotSaved = true;
        } catch (dupErr) {
          if (dupErr.code !== 11000 || attempt === 2) throw dupErr;
          // Sync counter to actual max before retrying
          await TenantModelFactory.syncSequenceToMax(restaurantSlug, 'kot', KOTModel, 'kotNumber', 'KOT');
        }
      }
    } catch (kotError) {
      console.error('KOT creation error:', kotError);
    }

    // Print KOT silently
    const kotData = {
      restaurantName: restaurant.name,
      orderNumber: order.orderNumber,
      items: orderItems.map(item => ({
        name: item.name,
        quantity: item.quantity,
        addons: item.addons || []
      })),
      createdAt: order.createdAt
    };
    
    kotPrinter.printKOT(kotData).catch(err => 
      console.error('KOT print failed:', err)
    );

    res.status(201).json({
      message: "Order created successfully",
      order: savedOrder,
    });
  } catch (error) {
    console.error("Create order error:", error);
    res.status(500).json({
      error: "Failed to create order",
      details: error.message,
    });
  }
};

/* =====================================================
   GET ORDERS
===================================================== */
const getOrders = async (req, res) => {
  try {
    if (!req.user?.restaurantSlug) return res.status(400).json({ error: "Restaurant slug not found" });
    const OrderModel = req.tenantModels?.Order || TenantModelFactory.getOrderModel(req.user.restaurantSlug);

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const skip = (page - 1) * limit;
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.date) {
      const d = new Date(req.query.date);
      filter.createdAt = { $gte: d, $lt: new Date(d.getTime() + 86400000) };
    }

    const [orders, total] = await Promise.all([
      OrderModel.find(filter)
        .select('orderNumber items extraItems subtotal discount gst sgst totalAmount customerName customerPhone tableId tableNumber mergedTables status priority createdAt paymentDetails hasSplitBill splitBillId splitBillSummary')
        .lean().sort({ createdAt: -1 }).skip(skip).limit(limit),
      OrderModel.countDocuments(filter)
    ]);

    res.json({ orders, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    console.error("Get orders error:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
};

/* =====================================================
   UPDATE ORDER STATUS
===================================================== */
const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = [
      "PENDING",
      "PREPARING",
      "READY",
      "DELIVERED",
      "CANCELLED",
      "PAID",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid order status" });
    }

    const OrderModel = TenantModelFactory.getOrderModel(req.user.restaurantSlug);

    const order = await OrderModel.findById(id);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    const previousStatus = order.status;
    order.status = status;
    
    // Map order status to item status
    const statusMapping = {
      "PENDING": "PENDING",
      "ORDER_ACCEPTED": "PENDING",
      "PREPARING": "PREPARING",
      "READY": "READY",
      "SERVED": "SERVED",
      "COMPLETE": "SERVED",
      "CANCELLED": "PENDING"
    };
    
    const itemStatus = statusMapping[status];
    
    // Update all items status
    if (itemStatus) {
      order.items.forEach(item => {
        item.status = itemStatus;
        if (itemStatus === 'PREPARING' && !item.startedAt) {
          item.startedAt = new Date();
        }
        if (itemStatus === 'READY' && !item.readyAt) {
          if (!item.startedAt) item.startedAt = new Date(Date.now() - 60000);
          item.readyAt = new Date();
          const seconds = Math.round((item.readyAt - item.startedAt) / 1000);
          const mins = Math.floor(seconds / 60);
          const secs = seconds % 60;
          item.actualPrepTime = `${mins}:${secs.toString().padStart(2, '0')}`;
        }
      });
      
      // Update extra items status
      if (order.extraItems && order.extraItems.length > 0) {
        order.extraItems.forEach(item => {
          item.status = itemStatus;
          if (itemStatus === 'PREPARING' && !item.startedAt) {
            item.startedAt = new Date();
          }
          if (itemStatus === 'READY' && !item.readyAt) {
            if (!item.startedAt) item.startedAt = new Date(Date.now() - 60000);
            item.readyAt = new Date();
            const seconds = Math.round((item.readyAt - item.startedAt) / 1000);
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            item.actualPrepTime = `${mins}:${secs.toString().padStart(2, '0')}`;
          }
        });
      }
    }
    
    const savedOrder = await order.save();

    // Restock inventory if order is cancelled
    if (status === 'CANCELLED' && previousStatus !== 'CANCELLED') {
      const allItems = [...order.items, ...(order.extraItems || [])];
      restockInventoryForItems(req.user.restaurantSlug, allItems, order.orderNumber).catch(err =>
        console.error('Inventory restock failed:', err)
      );
    }

    // Restore tables atomically — updateMany for original tables, delete merged
    if ((status === "CANCELLED" || status === "PAID") && order.tableId) {
      try {
        const TableModel = TenantModelFactory.getTableModel(req.user.restaurantSlug);
        const table = await TableModel.findById(order.tableId);
        if (table) {
          if (table.tableNumber?.startsWith('MG_T') && table.mergedWith?.length > 0) {
            await Promise.all([
              TableModel.updateMany({ _id: { $in: table.mergedWith } }, { status: 'AVAILABLE' }),
              TableModel.findByIdAndDelete(table._id)
            ]);
          } else {
            await TableModel.findByIdAndUpdate(order.tableId, { status: 'AVAILABLE' });
          }
        }
      } catch (tableError) { console.error('Table restore error:', tableError); }
    }

    // Update associated KOT status and items
    try {
      const KOTModel = TenantModelFactory.getKOTModel(req.user.restaurantSlug);
      const kots = await KOTModel.find({ orderId: id });
      for (const kot of kots) {
        kot.status = status;
        
        // Update KOT items status
        if (itemStatus) {
          kot.items.forEach((item, index) => {
            item.status = itemStatus;
            if (order.items[index]) {
              item.startedAt = order.items[index].startedAt;
              item.readyAt = order.items[index].readyAt;
              item.actualPrepTime = order.items[index].actualPrepTime;
            }
          });
          
          if (kot.extraItems && kot.extraItems.length > 0) {
            kot.extraItems.forEach((item, index) => {
              item.status = itemStatus;
              if (order.extraItems && order.extraItems[index]) {
                item.startedAt = order.extraItems[index].startedAt;
                item.readyAt = order.extraItems[index].readyAt;
                item.actualPrepTime = order.extraItems[index].actualPrepTime;
              }
            });
          }
        }
        
        await kot.save();
      }
    } catch (kotError) {
      console.error('KOT status sync error:', kotError);
    }

    res.json({
      message: "Order status updated successfully",
      order: savedOrder,
    });
  } catch (error) {
    console.error("Update order error:", error);
    res.status(500).json({ error: "Failed to update order status" });
  }
};

/* =====================================================
   PROCESS PAYMENT
===================================================== */
const processPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { method, amount, transactionId, loyaltyPointsUsed } = req.body;

    const OrderModel =
      req.tenantModels?.Order ||
      TenantModelFactory.getOrderModel(req.user.restaurantSlug);

    const order = await OrderModel.findById(id);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Handle loyalty points and update customer stats in one operation
    if (order.customerPhone) {
      try {
        const CustomerModel = TenantModelFactory.getModel(req.user.restaurantSlug, 'Customer', Customer);
        const LoyaltySettingsModel = TenantModelFactory.getModel(req.user.restaurantSlug, 'LoyaltySettings', LoyaltySettings);
        const [customer, loyaltySettings] = await Promise.all([
          CustomerModel.findOne({ phone: order.customerPhone }),
          LoyaltySettingsModel.findOne()
        ]);
        if (customer) {
          if (loyaltyPointsUsed && loyaltyPointsUsed > 0 && customer.loyaltyPoints >= loyaltyPointsUsed) {
            customer.loyaltyPoints -= loyaltyPointsUsed;
            customer.redeemedPoints = (customer.redeemedPoints || 0) + loyaltyPointsUsed;
          }
          customer.totalOrders = (customer.totalOrders || 0) + 1;
          customer.totalSpent = (customer.totalSpent || 0) + amount;
          customer.lastOrderDate = new Date();
          if (loyaltySettings) customer.loyaltyPoints = (customer.loyaltyPoints || 0) + Math.floor(amount * loyaltySettings.pointsPerRupee);
          await customer.save();
        } else {
          const newCustomer = { name: order.customerName || 'Guest', phone: order.customerPhone, totalOrders: 1, totalSpent: amount, lastOrderDate: new Date() };
          if (loyaltySettings) newCustomer.loyaltyPoints = Math.floor(amount * loyaltySettings.pointsPerRupee);
          await CustomerModel.create(newCustomer);
        }
      } catch (crmError) {
        console.error('CRM update error:', crmError);
      }
    }

    order.status = 'PAID';
    order.paymentDetails = {
      method,
      amount,
      transactionId,
      loyaltyPointsUsed: loyaltyPointsUsed || 0,
      paidAt: new Date(),
    };

    await order.save();

    // Restore tables atomically
    if (order.tableId) {
      try {
        const TableModel = TenantModelFactory.getTableModel(req.user.restaurantSlug);
        const table = await TableModel.findById(order.tableId);
        if (table) {
          if (table.tableNumber?.startsWith('MG_T') && table.mergedWith?.length > 0) {
            await Promise.all([
              TableModel.updateMany({ _id: { $in: table.mergedWith } }, { status: 'AVAILABLE' }),
              TableModel.findByIdAndDelete(table._id)
            ]);
          } else {
            await TableModel.findByIdAndUpdate(order.tableId, { status: 'AVAILABLE' });
          }
        }
      } catch (tableError) { console.error('Table restore error:', tableError); }
    }

    res.json({
      message: "Payment processed successfully",
      order,
      billing: {
        subtotal: order.subtotal,
        discount: order.discount,
        finalAmount: order.totalAmount,
        paidAmount: order.paymentDetails.amount
      }
    });
  } catch (error) {
    console.error("Process payment error:", error);
    res.status(500).json({ error: "Failed to process payment" });
  }
};

/* =====================================================
   UPDATE ORDER PRIORITY
===================================================== */
const updateOrderPriority = async (req, res) => {
  try {
    const { id } = req.params;
    const { priority } = req.body;
    const OrderModel = TenantModelFactory.getOrderModel(req.user.restaurantSlug);
    const KOTModel = TenantModelFactory.getKOTModel(req.user.restaurantSlug);
    
    const order = await OrderModel.findByIdAndUpdate(
      id,
      { priority },
      { new: true }
    );
    
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    
    // Sync priority with associated KOTs
    await KOTModel.updateMany(
      { orderId: id },
      { priority }
    );
    
    res.json({
      message: "Order priority updated successfully",
      order
    });
  } catch (error) {
    console.error("Update order priority error:", error);
    res.status(500).json({ error: "Failed to update order priority" });
  }
};

/* =====================================================
   GET KOT DATA
===================================================== */
const getKOTData = async (req, res) => {
  try {
    const { id } = req.params;
    
    const { kotData } = await prepareKOTData(id, req.user.restaurantSlug, true);
    
    res.json({ kot: kotData });
  } catch (error) {
    console.error("Get KOT error:", error);
    if (error.message === "Order not found") {
      return res.status(404).json({ error: "Order not found" });
    }
    res.status(500).json({ error: "Failed to get KOT data" });
  }
};

/* =====================================================
   PRINT KOT
===================================================== */
const printKOT = async (req, res) => {
  try {
    const { id } = req.params;
    
    const { kotData } = await prepareKOTData(id, req.user.restaurantSlug);
    
    const result = await kotPrinter.printKOT(kotData);
    
    if (result.success) {
      res.json({ message: "KOT printed successfully" });
    } else {
      res.status(500).json({ error: "Failed to print KOT", details: result.error });
    }
  } catch (error) {
    console.error("Print KOT error:", error);
    if (error.message === "Order not found") {
      return res.status(404).json({ error: "Order not found" });
    }
    res.status(500).json({ error: "Failed to print KOT" });
  }
};

/* =====================================================
   UPDATE ITEM STATUS
===================================================== */
const updateItemStatus = async (req, res) => {
  try {
    const { orderId, itemIndex } = req.params;
    const { status } = req.body;

    const allowedStatuses = ["PENDING", "PREPARING", "READY", "SERVED"];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid item status" });
    }

    const OrderModel = TenantModelFactory.getOrderModel(req.user.restaurantSlug);
    const KOTModel = TenantModelFactory.getKOTModel(req.user.restaurantSlug);

    // Update item status in order
    const order = await OrderModel.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (!order.items[itemIndex]) {
      return res.status(404).json({ error: "Item not found" });
    }

    order.items[itemIndex].status = status;
    
    // Track preparation time
    if (status === 'PREPARING') {
      if (!order.items[itemIndex].startedAt) {
        order.items[itemIndex].startedAt = new Date();
      }
    }
    if (status === 'READY') {
      if (!order.items[itemIndex].startedAt) {
        order.items[itemIndex].startedAt = new Date(Date.now() - 60000); // Default 1 min ago if missing
      }
      order.items[itemIndex].readyAt = new Date();
      const seconds = Math.round((order.items[itemIndex].readyAt - order.items[itemIndex].startedAt) / 1000);
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      order.items[itemIndex].actualPrepTime = `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    // Check if all items are SERVED and update order status to READY
    const allItems = [...order.items, ...(order.extraItems || [])];
    const allServed = allItems.length > 0 && allItems.every(item => item.status === 'SERVED');
    if (allServed && order.status !== 'READY') {
      order.status = 'READY';
    }
    
    await order.save();

    // Update corresponding item in KOT
    const kot = await KOTModel.findOne({ orderId });
    if (kot && kot.items[itemIndex]) {
      kot.items[itemIndex].status = status;
      if (status === 'PREPARING' && order.items[itemIndex].startedAt) {
        kot.items[itemIndex].startedAt = order.items[itemIndex].startedAt;
      }
      if (status === 'READY' && order.items[itemIndex].readyAt) {
        kot.items[itemIndex].readyAt = order.items[itemIndex].readyAt;
        kot.items[itemIndex].actualPrepTime = order.items[itemIndex].actualPrepTime;
      }
      kot.markModified('items');
      await kot.save();
    }

    res.json({
      message: "Item status updated successfully",
      order,
      kot
    });
  } catch (error) {
    console.error("Update item status error:", error);
    res.status(500).json({ error: "Failed to update item status" });
  }
};

/* =====================================================
   ADD EXTRA ITEMS TO ORDER
===================================================== */
const addExtraItemsToOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { extraItems } = req.body;

    if (!extraItems || !extraItems.length) {
      return res.status(400).json({ error: "Extra items are required" });
    }

    const restaurantSlug = req.user?.restaurantSlug;
    if (!restaurantSlug) {
      return res.status(400).json({ error: "Restaurant slug not found" });
    }

    const OrderModel = TenantModelFactory.getOrderModel(restaurantSlug);
    const KOTModel = TenantModelFactory.getKOTModel(restaurantSlug);
    const MenuModel = TenantModelFactory.getMenuItemModel(restaurantSlug);
    const VariationModel = TenantModelFactory.getVariationModel(restaurantSlug);
    const AddonModel = TenantModelFactory.getAddonModel(restaurantSlug);

    const order = await OrderModel.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    let existingKOT = await KOTModel.findOne({ orderId });
    if (!existingKOT) {
      return res.status(404).json({ error: "KOT not found for this order" });
    }

    // Batch fetch all menu items, variations, addons in 3 queries
    const menuIds = [...new Set(extraItems.map(i => i.menuId))];
    const variationIds = [...new Set(extraItems.flatMap(i => i.variation?.variationId ? [i.variation.variationId] : []))];
    const addonIds = [...new Set(extraItems.flatMap(i => (i.addons || []).map(a => a.addonId).filter(Boolean)))];

    const [menuItemsArr, variationsArr, addonsArr] = await Promise.all([
      MenuModel.find({ _id: { $in: menuIds } }).lean(),
      variationIds.length ? VariationModel.find({ _id: { $in: variationIds } }).lean() : [],
      addonIds.length ? AddonModel.find({ _id: { $in: addonIds } }).lean() : []
    ]);
    const menuMap = Object.fromEntries(menuItemsArr.map(m => [m._id.toString(), m]));
    const variationMap = Object.fromEntries(variationsArr.map(v => [v._id.toString(), v]));
    const addonMap = Object.fromEntries(addonsArr.map(a => [a._id.toString(), a]));

    let totalAmount = 0;
    const newExtraItems = [];
    const newKOTExtraItems = [];

    for (const item of extraItems) {
      const { menuId, quantity, variation, addons } = item;
      if (!menuId || !quantity) return res.status(400).json({ error: 'Invalid extra item data' });

      const menuItem = menuMap[menuId?.toString()];
      if (!menuItem) return res.status(400).json({ error: 'Menu item not available' });

      let finalVariation = null, variationPrice = 0;
      if (variation?.variationId) {
        const v = variationMap[variation.variationId.toString()];
        if (v) { variationPrice = v.price; finalVariation = { variationId: v._id, name: v.name, price: v.price }; }
      }

      let addonsTotal = 0;
      const finalAddons = [];
      for (const addon of (addons || [])) {
        if (addon.addonId) {
          const a = addonMap[addon.addonId.toString()];
          if (a) { addonsTotal += a.price; finalAddons.push({ addonId: a._id, name: a.name, price: a.price }); }
        }
      }

      const itemTotal = (variationPrice + addonsTotal) * quantity;
      totalAmount += itemTotal;
      newExtraItems.push({ menuId: menuItem._id, name: menuItem.itemName, basePrice: 0, quantity, variation: finalVariation, addons: finalAddons, itemTotal, status: 'PENDING', startedAt: null, readyAt: null, actualPrepTime: null });
      newKOTExtraItems.push({ menuId: menuItem._id, name: menuItem.itemName, quantity, variation: finalVariation, addons: finalAddons, status: 'PENDING' });
    }

    order.extraItems.push(...newExtraItems);
    order.totalAmount += totalAmount;
    await order.save();

    existingKOT.extraItems.push(...newKOTExtraItems);
    await existingKOT.save();

    res.json({
      message: "Extra items added successfully",
      order,
      kot: existingKOT
    });
  } catch (error) {
    console.error("Add extra items error:", error);
    res.status(500).json({
      error: "Failed to add extra items",
      details: error.message,
    });
  }
};

/* =====================================================
   UPDATE EXTRA ITEM STATUS
===================================================== */
const updateExtraItemStatus = async (req, res) => {
  try {
    const { orderId, itemIndex } = req.params;
    const { status } = req.body;

    const allowedStatuses = ["PENDING", "PREPARING", "READY", "SERVED"];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid extra item status" });
    }

    const OrderModel = TenantModelFactory.getOrderModel(req.user.restaurantSlug);
    const KOTModel = TenantModelFactory.getKOTModel(req.user.restaurantSlug);

    const order = await OrderModel.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (!order.extraItems[itemIndex]) {
      return res.status(404).json({ error: "Extra item not found" });
    }

    order.extraItems[itemIndex].status = status;
    
    // Track preparation time
    if (status === 'PREPARING') {
      if (!order.extraItems[itemIndex].startedAt) {
        order.extraItems[itemIndex].startedAt = new Date();
      }
    }
    if (status === 'READY') {
      if (!order.extraItems[itemIndex].startedAt) {
        order.extraItems[itemIndex].startedAt = new Date(Date.now() - 60000); // Default 1 min ago if missing
      }
      order.extraItems[itemIndex].readyAt = new Date();
      const seconds = Math.round((order.extraItems[itemIndex].readyAt - order.extraItems[itemIndex].startedAt) / 1000);
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      order.extraItems[itemIndex].actualPrepTime = `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    // Check if all items are SERVED and update order status to READY
    const allItems = [...order.items, ...(order.extraItems || [])];
    const allServed = allItems.length > 0 && allItems.every(item => item.status === 'SERVED');
    if (allServed && order.status !== 'READY') {
      order.status = 'READY';
    }
    
    await order.save();

    const kot = await KOTModel.findOne({ orderId });
    if (kot && kot.extraItems[itemIndex]) {
      kot.extraItems[itemIndex].status = status;
      if (status === 'PREPARING' && order.extraItems[itemIndex].startedAt) {
        kot.extraItems[itemIndex].startedAt = order.extraItems[itemIndex].startedAt;
      }
      if (status === 'READY' && order.extraItems[itemIndex].readyAt) {
        kot.extraItems[itemIndex].readyAt = order.extraItems[itemIndex].readyAt;
        kot.extraItems[itemIndex].actualPrepTime = order.extraItems[itemIndex].actualPrepTime;
      }
      kot.markModified('extraItems');
      await kot.save();
    }

    res.json({
      message: "Extra item status updated successfully",
      order,
      kot
    });
  } catch (error) {
    console.error("Update extra item status error:", error);
    res.status(500).json({ error: "Failed to update extra item status" });
  }
};

/* =====================================================
   APPLY COUPON TO ORDER
===================================================== */
const applyCoupon = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { couponCode, customerId, employeeId } = req.body;

    if (!couponCode) {
      return res.status(400).json({ error: "Coupon code is required" });
    }

    const OrderModel = TenantModelFactory.getOrderModel(req.user.restaurantSlug);
    const order = await OrderModel.findById(orderId);
    
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.status === 'PAID' || order.status === 'CANCELLED') {
      return res.status(400).json({ error: "Cannot apply coupon to paid or cancelled orders" });
    }

    const restaurant = await getRestaurant(req.user.restaurantSlug);
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });
    
    const discount = await Discount.findOne({ 
      restaurantId: restaurant._id,
      code: couponCode.toUpperCase(),
      isActive: true 
    });
    
    if (!discount) {
      return res.status(404).json({ error: 'Invalid coupon code' });
    }
    
    const now = new Date();
    if (now < discount.validFrom || now > discount.validUntil) {
      return res.status(400).json({ error: 'Coupon has expired or not yet valid' });
    }
    
    // Check usage limits
    if (discount.usageLimit && discount.usageCount >= discount.usageLimit) {
      return res.status(400).json({ error: 'Coupon usage limit reached' });
    }
    
    if (discount.perUserLimit && customerId) {
      const userUsage = await DiscountUsage.countDocuments({ discountId: discount._id, customerId });
      if (userUsage >= discount.perUserLimit) {
        return res.status(400).json({ error: 'You have reached the usage limit for this coupon' });
      }
    }
    
    const orderTotal = order.subtotal || order.totalAmount;
    
    // Check minimum order amount
    if (orderTotal < discount.minOrderAmount) {
      return res.status(400).json({ error: `Minimum order amount is ${discount.minOrderAmount}` });
    }
    
    // Type-specific validations
    if (discount.type === 'employee') {
      if (!employeeId) return res.status(400).json({ error: 'Employee ID required' });
      if (!discount.allEmployees && !discount.employeeIds.includes(employeeId)) {
        return res.status(400).json({ error: 'Not eligible for employee discount' });
      }
    }
    
    // Calculate discount
    const items = [...order.items, ...(order.extraItems || [])];
    let applicableAmount = orderTotal;
    
    if (!discount.applyToAll && (discount.applicableItems?.length || discount.applicableCategories?.length)) {
      applicableAmount = items.reduce((sum, item) => {
        const isApplicable = discount.applicableItems?.some(id => id.toString() === item.menuId.toString()) || 
                            discount.applicableCategories?.some(id => id.toString() === item.categoryId?.toString());
        return sum + (isApplicable ? item.itemTotal : 0);
      }, 0);
    }
    
    let discountAmount = discount.discountType === 'percentage' 
      ? (applicableAmount * discount.value) / 100 
      : discount.value;
    
    if (discount.maxDiscountAmount) {
      discountAmount = Math.min(discountAmount, discount.maxDiscountAmount);
    }
    
    discountAmount = Math.round(discountAmount * 100) / 100;
    
    // Apply discount to order
    order.discount = {
      amount: discountAmount,
      reason: discount.name,
      couponCode: couponCode.toUpperCase(),
      discountId: discount._id,
      appliedBy: req.user?.id || null,
    };
    
    // Recalculate total
    const afterDiscount = orderTotal - discountAmount;
    const gstAmount = (afterDiscount * 2.5) / 100;
    const sgstAmount = (afterDiscount * 2.5) / 100;
    order.totalAmount = afterDiscount + gstAmount + sgstAmount;
    
    await order.save();
    
    // Track usage
    discount.usageCount += 1;
    await discount.save();
    
    await DiscountUsage.create({
      discountId: discount._id,
      customerId: customerId || null,
      orderId: order._id,
      restaurantId: restaurant._id,
      discountAmount
    });

    res.json({
      message: "Coupon applied successfully",
      order,
      discountApplied: {
        code: couponCode.toUpperCase(),
        name: discount.name,
        amount: discountAmount,
        finalTotal: order.totalAmount
      }
    });
  } catch (error) {
    console.error("Apply coupon error:", error);
    res.status(500).json({ error: "Failed to apply coupon" });
  }
};

/* =====================================================
   REMOVE COUPON FROM ORDER
===================================================== */
const removeCoupon = async (req, res) => {
  try {
    const { orderId } = req.params;

    const OrderModel = TenantModelFactory.getOrderModel(req.user.restaurantSlug);
    const order = await OrderModel.findById(orderId);
    
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.status === 'PAID' || order.status === 'CANCELLED') {
      return res.status(400).json({ error: "Cannot remove coupon from paid or cancelled orders" });
    }

    if (!order.discount || !order.discount.couponCode) {
      return res.status(400).json({ error: "No coupon applied to this order" });
    }

    // Recalculate total without discount
    const subtotal = order.subtotal || order.totalAmount;
    const gstAmount = (subtotal * 2.5) / 100;
    const sgstAmount = (subtotal * 2.5) / 100;
    order.totalAmount = subtotal + gstAmount + sgstAmount;
    
    // Remove discount
    order.discount = undefined;
    
    await order.save();

    res.json({
      message: "Coupon removed successfully",
      order
    });
  } catch (error) {
    console.error("Remove coupon error:", error);
    res.status(500).json({ error: "Failed to remove coupon" });
  }
};

/* =====================================================
   APPLY DISCOUNT TO ORDER
===================================================== */
const applyDiscount = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { percentage, reason } = req.body;

    if (!percentage || percentage <= 0 || percentage > 100) {
      return res.status(400).json({ error: "Percentage must be between 0.01 and 100" });
    }

    const OrderModel = TenantModelFactory.getOrderModel(req.user.restaurantSlug);
    const order = await OrderModel.findById(orderId);
    
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.status === 'PAID' || order.status === 'CANCELLED') {
      return res.status(400).json({ error: "Cannot apply discount to paid or cancelled orders" });
    }

    const subtotal = order.subtotal || order.totalAmount;
    const discountAmount = (subtotal * percentage) / 100;
    const finalTotal = subtotal - discountAmount;

    order.subtotal = subtotal;
    order.discount = {
      percentage,
      amount: discountAmount,
      reason: reason || "",
      appliedBy: req.user?.id || null,
    };
    order.totalAmount = finalTotal;

    await order.save();

    res.json({
      message: "Discount applied successfully",
      order,
      discountApplied: {
        percentage,
        amount: discountAmount,
        finalTotal
      }
    });
  } catch (error) {
    console.error("Apply discount error:", error);
    res.status(500).json({ error: "Failed to apply discount" });
  }
};

/* =====================================================
   GET SINGLE ORDER
===================================================== */
const getOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const OrderModel = TenantModelFactory.getOrderModel(req.user.restaurantSlug);
    
    const order = await OrderModel.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    
    res.json({ order });
  } catch (error) {
    console.error("Get order error:", error);
    res.status(500).json({ error: "Failed to get order" });
  }
};

/* =====================================================
   EXPORTS
===================================================== */
module.exports = {
  createOrder,
  addItemsToOrder,
  addExtraItemsToOrder,
  getOrders,
  getOrder,
  updateOrderStatus,
  updateItemStatus,
  updateExtraItemStatus,
  processPayment,
  updateOrderPriority,
  applyCoupon,
  removeCoupon,
  applyDiscount,
  getKOTData,
  printKOT,
};
