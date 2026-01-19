const { validationResult } = require("express-validator");
const TenantModelFactory = require("../models/TenantModelFactory");

// Get all tables
const getTables = async (req, res) => {
  try {
    const TableModel = TenantModelFactory.getTableModel(req.user.restaurantSlug);
    const tables = await TableModel.find({ isActive: true }).sort({ tableNumber: 1 });
    
    res.json({ tables });
  } catch (error) {
    console.error("Get tables error:", error);
    res.status(500).json({ error: "Failed to fetch tables" });
  }
};

// Create table
const createTable = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const TableModel = TenantModelFactory.getTableModel(req.user.restaurantSlug);
    const { tableNumber, capacity, location } = req.body;

    const table = new TableModel({
      tableNumber,
      capacity,
      location,
    });

    await table.save();
    res.status(201).json({ message: "Table created successfully", table });
  } catch (error) {
    console.error("Create table error:", error);
    if (error.code === 11000) {
      return res.status(400).json({ error: "Table number already exists" });
    }
    res.status(500).json({ error: "Failed to create table" });
  }
};

// Update table status
const updateTableStatus = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const TableModel = TenantModelFactory.getTableModel(req.user.restaurantSlug);
    const { id } = req.params;
    const { status } = req.body;

    const table = await TableModel.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!table) {
      return res.status(404).json({ error: "Table not found" });
    }

    res.json({ message: "Table status updated", table });
  } catch (error) {
    console.error("Update table status error:", error);
    res.status(500).json({ error: "Failed to update table status" });
  }
};

// Get all bookings
const getBookings = async (req, res) => {
  try {
    const TableBookingModel = TenantModelFactory.getTableBookingModel(req.user.restaurantSlug);
    const { date, status } = req.query;
    
    let filter = {};
    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
      filter.bookingDate = { $gte: startDate, $lt: endDate };
    }
    if (status) {
      filter.status = status;
    }

    const bookings = await TableBookingModel.find(filter)
      .populate("tableId", "tableNumber capacity location")
      .sort({ bookingDate: 1, bookingTime: 1 });

    res.json({ bookings });
  } catch (error) {
    console.error("Get bookings error:", error);
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
};

// Create booking
const createBooking = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const TableBookingModel = TenantModelFactory.getTableBookingModel(req.user.restaurantSlug);
    const TableModel = TenantModelFactory.getTableModel(req.user.restaurantSlug);
    
    const {
      tableId,
      customerName,
      customerPhone,
      customerEmail,
      partySize,
      bookingDate,
      bookingTime,
      duration,
      specialRequests,
    } = req.body;

    const table = await TableModel.findById(tableId);
    if (!table) {
      return res.status(404).json({ error: "Table not found" });
    }

    if (table.capacity < partySize) {
      return res.status(400).json({ error: "Table capacity insufficient for party size" });
    }

    const booking = new TableBookingModel({
      tableId,
      customerName,
      customerPhone,
      customerEmail,
      partySize,
      bookingDate,
      bookingTime,
      duration,
      specialRequests,
    });

    await booking.save();
    await booking.populate("tableId", "tableNumber capacity location");

    res.status(201).json({ message: "Booking created successfully", booking });
  } catch (error) {
    console.error("Create booking error:", error);
    res.status(500).json({ error: "Failed to create booking" });
  }
};

// Update booking status
const updateBookingStatus = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const TableBookingModel = TenantModelFactory.getTableBookingModel(req.user.restaurantSlug);
    const TableModel = TenantModelFactory.getTableModel(req.user.restaurantSlug);
    
    const { id } = req.params;
    const { status } = req.body;

    const booking = await TableBookingModel.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    ).populate("tableId");

    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    if (status === "SEATED") {
      await TableModel.findByIdAndUpdate(booking.tableId._id, { status: "OCCUPIED" });
    } else if (status === "COMPLETED" || status === "CANCELLED" || status === "NO_SHOW") {
      await TableModel.findByIdAndUpdate(booking.tableId._id, { status: "AVAILABLE" });
    }

    res.json({ message: "Booking status updated", booking });
  } catch (error) {
    console.error("Update booking status error:", error);
    res.status(500).json({ error: "Failed to update booking status" });
  }
};

// Get available tables
const getAvailableTables = async (req, res) => {
  try {
    const TableModel = TenantModelFactory.getTableModel(req.user.restaurantSlug);
    const { partySize } = req.query;
    
    let filter = { isActive: true, status: "AVAILABLE" };
    if (partySize) {
      filter.capacity = { $gte: parseInt(partySize) };
    }

    const availableTables = await TableModel.find(filter);
    res.json({ availableTables });
  } catch (error) {
    console.error("Get available tables error:", error);
    res.status(500).json({ error: "Failed to fetch available tables" });
  }
};

// Order food from table
const orderFromTable = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { tableId } = req.params;
    const { items, customerName } = req.body;

    const TableModel = TenantModelFactory.getTableModel(req.user.restaurantSlug);
    const OrderModel = TenantModelFactory.getOrderModel(req.user.restaurantSlug);
    const MenuItemModel = TenantModelFactory.getMenuItemModel(req.user.restaurantSlug);
    const VariationModel = TenantModelFactory.getVariationModel(req.user.restaurantSlug);
    const AddonModel = TenantModelFactory.getAddonModel(req.user.restaurantSlug);

    const table = await TableModel.findById(tableId);
    if (!table) {
      return res.status(404).json({ error: "Table not found" });
    }

    let totalAmount = 0;
    const orderItems = [];

    for (const item of items) {
      const { menuId, quantity, variation, addons } = item;
      const menuItem = await MenuItemModel.findById(menuId);
      
      if (!menuItem) {
        return res.status(400).json({ error: `Menu item not found: ${menuId}` });
      }

      let variationPrice = 0;
      let finalVariation = null;
      
      if (variation?.variationId) {
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
      
      if (addons?.length) {
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

      const itemTotal = (variationPrice + addonsTotal) * quantity;
      totalAmount += itemTotal;

      orderItems.push({
        menuId: menuItem._id,
        name: menuItem.itemName,
        basePrice: 0,
        quantity,
        variation: finalVariation,
        addons: finalAddons,
        itemTotal,
      });
    }

    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const order = new OrderModel({
      orderNumber,
      items: orderItems,
      totalAmount,
      customerName: customerName || `Table ${table.tableNumber}`,
      tableId: table._id,
      tableNumber: table.tableNumber,
    });

    await order.save();
    await TableModel.findByIdAndUpdate(tableId, { status: "OCCUPIED" });

    res.status(201).json({ message: "Order placed successfully", order });
  } catch (error) {
    console.error("Order from table error:", error);
    res.status(500).json({ error: "Failed to place order" });
  }
};

// Get menu for table
const getMenuForTable = async (req, res) => {
  try {
    const { tableId } = req.params;

    const TableModel = TenantModelFactory.getTableModel(req.user.restaurantSlug);
    const MenuItemModel = TenantModelFactory.getMenuItemModel(req.user.restaurantSlug);
    const CategoryModel = TenantModelFactory.getCategoryModel(req.user.restaurantSlug);
    const VariationModel = TenantModelFactory.getVariationModel(req.user.restaurantSlug);
    const AddonModel = TenantModelFactory.getAddonModel(req.user.restaurantSlug);

    const table = await TableModel.findById(tableId);
    if (!table) {
      return res.status(404).json({ error: "Table not found" });
    }

    const menuItems = await MenuItemModel.find({ status: 'active' })
      .populate('categoryID', 'name')
      .populate('variation')
      .populate('addon');

    const categories = await CategoryModel.find({ isActive: true });

    res.json({ 
      table: {
        tableNumber: table.tableNumber,
        capacity: table.capacity,
        status: table.status
      },
      categories,
      menuItems 
    });
  } catch (error) {
    console.error("Get menu for table error:", error);
    res.status(500).json({ error: "Failed to fetch menu" });
  }
};

module.exports = {
  getTables,
  createTable,
  updateTableStatus,
  getBookings,
  createBooking,
  updateBookingStatus,
  getAvailableTables,
  orderFromTable,
  getMenuForTable,
};