const { validationResult } = require("express-validator");
const TenantModelFactory = require("../models/TenantModelFactory");
const Restaurant = require("../models/Restaurant");
const kotPrinter = require("../utils/kotPrinter");

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

    const { items, customerName, customerPhone } = req.body;

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
      });
    }

    const orderNumber = `ORD-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 6)
      .toUpperCase()}`;

    const OrderModel =
      req.tenantModels?.Order ||
      TenantModelFactory.getOrderModel(restaurantSlug);

    const order = new OrderModel({
      orderNumber,
      items: orderItems,
      totalAmount,
      customerName,
      customerPhone: customerPhone || "",
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
          addons: item.addons
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

    const orders = await OrderModel.find().sort({ createdAt: -1 });

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

    const allowedStatuses = [
      "PENDING",
      "ORDER_ACCEPTED",
      "PREPARING",
      "READY",
      "SERVED",
      "COMPLETE",
      "CANCELLED",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid order status" });
    }

    const OrderModel =
      req.tenantModels?.Order ||
      TenantModelFactory.getOrderModel(req.user.restaurantSlug);

    const order = await OrderModel.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json({
      message: "Order status updated successfully",
      order,
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

    const existingOrder = await OrderModel.findById(id);
    if (!existingOrder) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (amount !== existingOrder.totalAmount) {
      return res
        .status(400)
        .json({ error: "Payment amount does not match order total" });
    }

    const order = await OrderModel.findByIdAndUpdate(
      id,
      {
        paymentDetails: {
          method,
          amount: existingOrder.totalAmount,
          transactionId,
          paidAt: new Date(),
        },
      },
      { new: true }
    );

    res.json({
      message: "Payment processed successfully",
      order,
    });
  } catch (error) {
    console.error("Process payment error:", error);
    res.status(500).json({ error: "Failed to process payment" });
  }
};

/* =====================================================
   EXPORTS
===================================================== */
module.exports = {
  createOrder,
  getOrders,
  updateOrderStatus,
  processPayment,
};
