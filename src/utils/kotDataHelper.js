const TenantModelFactory = require("../models/TenantModelFactory");
const Restaurant = require("../models/Restaurant");

const prepareKOTData = async (orderId, restaurantSlug, includeFullDetails = false) => {
  const OrderModel = TenantModelFactory.getOrderModel(restaurantSlug);
  
  const order = await OrderModel.findById(orderId);
  if (!order) {
    throw new Error("Order not found");
  }
  
  const restaurant = await Restaurant.findOne({ slug: restaurantSlug });
  
  const kotData = {
    restaurantName: restaurant?.name || 'Restaurant',
    restaurantSlug,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    items: order.items.map(item => ({
      name: item.name,
      quantity: item.quantity,
      addons: item.addons || []
    })),
    createdAt: order.createdAt
  };

  if (includeFullDetails) {
    kotData.tableNumber = order.tableNumber;
    kotData.items = order.items.map(item => ({
      name: item.name,
      quantity: item.quantity,
      category: item.category,
      variation: item.variation,
      addons: item.addons || [],
      notes: item.notes
    }));
    kotData.status = order.status;
  }

  return { order, kotData };
};

module.exports = { prepareKOTData };