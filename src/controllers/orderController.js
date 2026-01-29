const { validationResult } = require("express-validator");
const TenantModelFactory = require("../models/TenantModelFactory");
const Restaurant = require("../models/Restaurant");
const kotPrinter = require("../utils/kotPrinter");
const { prepareKOTData } = require("../utils/kotDataHelper");

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

    let totalAmount = 0;
    const newOrderItems = [];
    const newKOTItems = [];

    // Process new items
    for (const item of items) {
      const { menuId, quantity, variation, addons } = item;

      if (!menuId || !quantity) {
        return res.status(400).json({ error: "Invalid item data" });
      }

      const menuItem = await MenuModel.findById(menuId);
      if (!menuItem || !menuItem.isAvailable) {
        return res.status(400).json({ error: "Menu item not available" });
      }

      // Check if same item exists with "SERVED" status
      const existingItemIndex = existingOrder.items.findIndex(existingItem => 
        existingItem.menuId.toString() === menuId.toString() &&
        JSON.stringify(existingItem.variation) === JSON.stringify(variation) &&
        JSON.stringify(existingItem.addons) === JSON.stringify(addons) &&
        existingItem.status === "SERVED"
      );

      // Price calculation
      const basePrice = 0;
      let finalVariation = null;
      let variationPrice = 0;

      if (variation && variation.variationId) {
        const validVariation = await VariationModel.findById(variation.variationId);
        if (validVariation) {
          variationPrice = validVariation.price;
          finalVariation = {
            variationId: validVariation._id,
            name: validVariation.name,
            price: validVariation.price,
          };
        }
      }

      let addonsTotal = 0;
      const finalAddons = [];

      if (addons && addons.length) {
        for (const addon of addons) {
          if (addon.addonId) {
            const validAddon = await AddonModel.findById(addon.addonId);
            if (validAddon) {
              addonsTotal += validAddon.price;
              finalAddons.push({
                addonId: validAddon._id,
                name: validAddon.name,
                price: validAddon.price,
              });
            }
          }
        }
      }

      const itemTotal = (basePrice + variationPrice + addonsTotal) * quantity;
      totalAmount += itemTotal;

      if (existingItemIndex !== -1) {
        // Same item with SERVED status exists - add as new line item with PENDING status
        console.log('Same item with SERVED status found, adding as new line item');
      }

      // Always add as new line item (requirement: add new line item)
      const newItem = {
        menuId: menuItem._id,
        name: menuItem.itemName,
        basePrice,
        quantity,
        variation: finalVariation,
        addons: finalAddons,
        itemTotal,
        status: "PENDING" // New items are always pending
      };

      newOrderItems.push(newItem);
      newKOTItems.push({
        menuId: menuItem._id,
        name: menuItem.itemName,
        quantity,
        variation: finalVariation,
        addons: finalAddons,
        status: "PENDING"
      });
    }

    // Add new items to existing order
    existingOrder.items.push(...newOrderItems);
    existingOrder.totalAmount += totalAmount;
    await existingOrder.save();

    // Add new items to existing KOT (reuse same KOT)
    existingKOT.extraItems.push(...newKOTItems);
    await existingKOT.save();

    console.log('Items added to existing order:', existingOrder.orderNumber);
    console.log('Items added to existing KOT:', existingKOT.kotNumber);

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

    const restaurant = await Restaurant.findOne({ slug: restaurantSlug });
    if (!restaurant) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    if (!restaurant.isActive) {
      return res.status(403).json({
        error: "Restaurant is temporarily not accepting orders",
      });
    }

    const MenuModel =
      req.tenantModels?.MenuItem ||
      TenantModelFactory.getMenuItemModel(restaurantSlug);

    let totalAmount = 0;
    const orderItems = [];

    for (const item of items) {
      const { menuId, quantity, variation, addons } = item;

      if (!menuId || !quantity) {
        return res.status(400).json({ error: "Invalid item data" });
      }

      const menuItem = await MenuModel.findById(menuId);
      if (!menuItem || !menuItem.isAvailable) {
        return res
          .status(400)
          .json({ error: "Menu item not available" });
      }

      /* ===============================
         PRICE CALCULATION (SAFE)
      ================================ */
      const basePrice = 0; // Menu items don't have base price, only variations do

      // Get variation and addon details from TenantModelFactory
      const VariationModel = TenantModelFactory.getVariationModel(restaurantSlug);
      const AddonModel = TenantModelFactory.getAddonModel(restaurantSlug);

      // Validate variation
      let finalVariation = null;
      let variationPrice = 0;

      if (variation && variation.variationId) {
        const validVariation = await VariationModel.findById(variation.variationId);

        if (validVariation) {
          variationPrice = validVariation.price;
          finalVariation = {
            variationId: validVariation._id,
            name: validVariation.name,
            price: validVariation.price,
          };
        }
      }

      // Validate addons
      let addonsTotal = 0;
      const finalAddons = [];

      if (addons && addons.length) {
        for (const addon of addons) {
          if (addon.addonId) {
            const validAddon = await AddonModel.findById(addon.addonId);

            if (validAddon) {
              addonsTotal += validAddon.price;
              finalAddons.push({
                addonId: validAddon._id,
                name: validAddon.name,
                price: validAddon.price,
              });
            }
          }
        }
      }

      const itemTotal =
        (basePrice + variationPrice + addonsTotal) * quantity;

      totalAmount += itemTotal;

      orderItems.push({
        menuId: menuItem._id,
        name: menuItem.itemName,
        basePrice,
        quantity,
        variation: finalVariation,
        addons: finalAddons,
        itemTotal,
        status: "PENDING", // Default status for new items
      });
    }

    const orderNumber = `ORD-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 6)
      .toUpperCase()}`;

    const OrderModel =
      req.tenantModels?.Order ||
      TenantModelFactory.getOrderModel(restaurantSlug);

    // Calculate discount if provided
    const { discount } = req.body;
    let subtotal = totalAmount;
    let discountAmount = 0;
    let finalTotal = totalAmount;

    if (discount && discount.percentage > 0) {
      discountAmount = (subtotal * discount.percentage) / 100;
      finalTotal = subtotal - discountAmount;
    }

    // Handle table assignment if provided
    let tableNumber = null;
    let mergedTables = [];
    if (tableId) {
      console.log('Table ID provided:', tableId);
      console.log('Restaurant slug:', restaurantSlug);
      const TableModel = TenantModelFactory.getTableModel(restaurantSlug);
      
      const table = await TableModel.findById(tableId);
      console.log('Found table:', table);
      
      if (table) {
        tableNumber = table.tableNumber;
        
        // If it's a merged table, store the original table IDs
        if (table.mergedWith && table.mergedWith.length > 0) {
          mergedTables = table.mergedWith;
          console.log('Merged tables stored:', mergedTables);
        }
        
        console.log('Updating table status to OCCUPIED for table:', tableNumber);
        
        // Update table status to occupied
        table.status = "OCCUPIED";
        await table.save();
        
        console.log('Table status updated to:', table.status);
      } else {
        console.log('Table not found with ID:', tableId);
      }
    }

    const order = new OrderModel({
      orderNumber,
      items: orderItems,
      subtotal,
      discount: discount ? {
        percentage: discount.percentage,
        amount: discountAmount,
        reason: discount.reason || "",
        appliedBy: req.user?.id || null,
      } : undefined,
      totalAmount: finalTotal,
      customerName,
      customerPhone: customerPhone || "",
      tableId: tableId || null,
      tableNumber: tableNumber,
      mergedTables: mergedTables.length > 0 ? mergedTables : undefined
    });

    const savedOrder = await order.save();
    console.log('Order saved successfully:', savedOrder.orderNumber, 'Status:', savedOrder.status);

    // Auto-create KOT when order is created
    try {
      const KOTModel = TenantModelFactory.getKOTModel(restaurantSlug);
      console.log('Creating KOT for order:', savedOrder.orderNumber);
      
      const kot = new KOTModel({
        orderId: savedOrder._id,
        orderNumber: savedOrder.orderNumber,
        items: orderItems.map(item => ({
          menuId: item.menuId,
          name: item.name,
          quantity: item.quantity,
          variation: item.variation,
          addons: item.addons,
          status: "PENDING" // Default status for KOT items
        })),
        customerName: savedOrder.customerName
      });
      
      const savedKOT = await kot.save();
      console.log('KOT created successfully:', savedKOT.kotNumber);
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
    if (!req.user?.restaurantSlug) {
      return res.status(400).json({ error: "Restaurant slug not found" });
    }

    const OrderModel =
      req.tenantModels?.Order ||
      TenantModelFactory.getOrderModel(req.user.restaurantSlug);

    const orders = await OrderModel.find()
      .select('orderNumber items extraItems subtotal discount totalAmount customerName customerPhone tableId tableNumber mergedTables status priority createdAt paymentDetails')
      .lean()
      .sort({ createdAt: -1 });

    res.json({ orders });
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

    console.log('UPDATE ORDER STATUS - ID:', id, 'Status:', status);

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

    order.status = status;
    const savedOrder = await order.save();
    
    console.log('Order status updated to:', savedOrder.status);

    // Update table status when order is completed or cancelled
    if ((status === "CANCELLED" || status === "PAID") && order.tableId) {
      const TableModel = TenantModelFactory.getTableModel(req.user.restaurantSlug);
      const table = await TableModel.findById(order.tableId);
      if (table) {
        // Check if it's a merged table
        if (table.tableNumber && table.tableNumber.startsWith('MG_T')) {
          // Delete merged table and restore original tables
          const originalTableIds = table.mergedWith || [];
          for (const tableId of originalTableIds) {
            const originalTable = await TableModel.findById(tableId);
            if (originalTable) {
              originalTable.status = 'AVAILABLE';
              await originalTable.save();
            }
          }
          await TableModel.findByIdAndDelete(table._id);
          console.log('Merged table deleted and original tables restored to AVAILABLE');
        } else {
          // Regular table - just set to available
          table.status = "AVAILABLE";
          await table.save();
          console.log('Table status updated to AVAILABLE');
        }
      }
    }

    // Update associated KOT status
    try {
      const KOTModel = TenantModelFactory.getKOTModel(req.user.restaurantSlug);
      const kots = await KOTModel.find({ orderId: id });
      for (const kot of kots) {
        kot.status = status;
        await kot.save();
      }
      console.log('KOT status synced to:', status);
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
    const { method, amount, transactionId } = req.body;

    const OrderModel =
      req.tenantModels?.Order ||
      TenantModelFactory.getOrderModel(req.user.restaurantSlug);

    const order = await OrderModel.findById(id);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Use totalAmount (which includes discount) for payment validation
    if (amount !== order.totalAmount) {
      return res
        .status(400)
        .json({ 
          error: "Payment amount does not match order total",
          expected: order.totalAmount,
          received: amount,
          discount: order.discount || null
        });
    }

    order.status = 'PAID';
    order.paymentDetails = {
      method,
      amount: order.totalAmount, // Use discounted total
      transactionId,
      paidAt: new Date(),
    };

    await order.save();

    // Update table status when payment is processed
    if (order.tableId) {
      const TableModel = TenantModelFactory.getTableModel(req.user.restaurantSlug);
      const table = await TableModel.findById(order.tableId);
      if (table) {
        // Check if it's a merged table
        if (table.tableNumber && table.tableNumber.startsWith('MG_T')) {
          // Delete merged table and restore original tables
          const originalTableIds = table.mergedWith || [];
          for (const tableId of originalTableIds) {
            const originalTable = await TableModel.findById(tableId);
            if (originalTable) {
              originalTable.status = 'AVAILABLE';
              await originalTable.save();
            }
          }
          await TableModel.findByIdAndDelete(table._id);
          console.log('Merged table deleted and original tables restored after payment');
        } else {
          // Regular table - set to available
          table.status = 'AVAILABLE';
          await table.save();
          console.log('Table status updated to AVAILABLE after payment');
        }
      }
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
    await order.save();

    // Update corresponding item in KOT
    const kot = await KOTModel.findOne({ orderId });
    if (kot && kot.items[itemIndex]) {
      kot.items[itemIndex].status = status;
      await kot.save();
    }

    console.log('Item status updated:', status, 'for item index:', itemIndex);

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

    console.log('Adding extra items to order:', orderId);
    console.log('Extra items data:', JSON.stringify(extraItems, null, 2));

    if (!extraItems || !extraItems.length) {
      return res.status(400).json({ error: "Extra items are required" });
    }

    const restaurantSlug = req.user?.restaurantSlug;
    if (!restaurantSlug) {
      return res.status(400).json({ error: "Restaurant slug not found" });
    }

    console.log('Restaurant slug:', restaurantSlug);

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

    let totalAmount = 0;
    const newExtraItems = [];
    const newKOTExtraItems = [];

    for (const item of extraItems) {
      const { menuId, quantity, variation, addons } = item;

      if (!menuId || !quantity) {
        return res.status(400).json({ error: "Invalid extra item data" });
      }

      const menuItem = await MenuModel.findById(menuId);
      if (!menuItem || !menuItem.isAvailable) {
        return res.status(400).json({ error: "Menu item not available" });
      }

      const basePrice = 0;
      let finalVariation = null;
      let variationPrice = 0;

      if (variation && variation.variationId) {
        const validVariation = await VariationModel.findById(variation.variationId);
        if (validVariation) {
          variationPrice = validVariation.price;
          finalVariation = {
            variationId: validVariation._id,
            name: validVariation.name,
            price: validVariation.price,
          };
        }
      }

      let addonsTotal = 0;
      const finalAddons = [];

      if (addons && addons.length) {
        for (const addon of addons) {
          if (addon.addonId) {
            const validAddon = await AddonModel.findById(addon.addonId);
            if (validAddon) {
              addonsTotal += validAddon.price;
              finalAddons.push({
                addonId: validAddon._id,
                name: validAddon.name,
                price: validAddon.price,
              });
            }
          }
        }
      }

      const itemTotal = (basePrice + variationPrice + addonsTotal) * quantity;
      totalAmount += itemTotal;

      const newExtraItem = {
        menuId: menuItem._id,
        name: menuItem.itemName,
        basePrice,
        quantity,
        variation: finalVariation,
        addons: finalAddons,
        itemTotal,
        status: "PENDING"
      };

      newExtraItems.push(newExtraItem);
      newKOTExtraItems.push({
        menuId: menuItem._id,
        name: menuItem.itemName,
        quantity,
        variation: finalVariation,
        addons: finalAddons,
        status: "PENDING"
      });
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
    await order.save();

    const kot = await KOTModel.findOne({ orderId });
    if (kot && kot.extraItems[itemIndex]) {
      kot.extraItems[itemIndex].status = status;
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
   WEBHOOK: GET ORDER HISTORY BY RESTAURANT ID
===================================================== */
const getOrderHistoryWebhook = async (req, res) => {
  try {
    const { restaurant_id } = req.params;
    
    // Find restaurant by ID
    const restaurant = await Restaurant.findById(restaurant_id);
    if (!restaurant) {
      return res.status(404).json({ error: "Restaurant not found" });
    }
    
    const OrderModel = TenantModelFactory.getOrderModel(restaurant.slug);
    
    // Get all orders with full details
    const orders = await OrderModel.find()
      .select('orderNumber items extraItems subtotal discount totalAmount customerName customerPhone tableId tableNumber status priority createdAt updatedAt paymentDetails')
      .lean()
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      restaurant: {
        id: restaurant._id,
        name: restaurant.name,
        slug: restaurant.slug
      },
      totalOrders: orders.length,
      orders
    });
  } catch (error) {
    console.error("Get order history webhook error:", error);
    res.status(500).json({ 
      success: false,
      error: "Failed to fetch order history",
      details: error.message 
    });
  }
};

/* =====================================================
   WEBHOOK: UPDATE ITEM STATUS BY RESTAURANT ID
===================================================== */
const updateItemStatusWebhook = async (req, res) => {
  try {
    const { restaurant_id } = req.params;
    const { orderId, itemIndex, status } = req.body;
    
    const allowedStatuses = ["PENDING", "PREPARING", "READY", "SERVED"];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid item status" });
    }
    
    // Find restaurant by ID
    const restaurant = await Restaurant.findById(restaurant_id);
    if (!restaurant) {
      return res.status(404).json({ error: "Restaurant not found" });
    }
    
    const OrderModel = TenantModelFactory.getOrderModel(restaurant.slug);
    const KOTModel = TenantModelFactory.getKOTModel(restaurant.slug);
    
    const order = await OrderModel.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    
    if (!order.items[itemIndex]) {
      return res.status(404).json({ error: "Item not found" });
    }
    
    order.items[itemIndex].status = status;
    await order.save();
    
    // Update KOT
    const kot = await KOTModel.findOne({ orderId });
    if (kot && kot.items[itemIndex]) {
      kot.items[itemIndex].status = status;
      await kot.save();
    }
    
    res.json({
      success: true,
      message: "Item status updated successfully",
      order
    });
  } catch (error) {
    console.error("Update item status webhook error:", error);
    res.status(500).json({ 
      success: false,
      error: "Failed to update item status",
      details: error.message 
    });
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
  applyDiscount,
  getKOTData,
  printKOT,
  getOrderHistoryWebhook,
  updateItemStatusWebhook,
};
