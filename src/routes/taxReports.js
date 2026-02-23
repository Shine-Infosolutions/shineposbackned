const express = require("express");
const auth = require("../middleware/auth");
const checkSubscription = require("../middleware/checkSubscription");
const TenantModelFactory = require("../models/TenantModelFactory");

const router = express.Router();

router.use(
  auth(["RESTAURANT_ADMIN", "MANAGER", "CASHIER"]),
  checkSubscription
);

router.get("/", async (req, res) => {
  try {
    const { period = 'monthly', month } = req.query;
    const restaurantSlug = req.user.restaurantSlug;
    const Order = TenantModelFactory.getModel(restaurantSlug, "Order");
    
    let startDate, endDate;
    const now = new Date();
    
    if (period === 'monthly') {
      const [year, monthNum] = (month || now.toISOString().slice(0, 7)).split('-');
      startDate = new Date(year, monthNum - 1, 1);
      endDate = new Date(year, monthNum, 0, 23, 59, 59);
    } else if (period === 'quarterly') {
      const quarter = Math.floor(now.getMonth() / 3);
      startDate = new Date(now.getFullYear(), quarter * 3, 1);
      endDate = new Date(now.getFullYear(), (quarter + 1) * 3, 0, 23, 59, 59);
    } else {
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
    }

    const orders = await Order.find({
      createdAt: { $gte: startDate, $lte: endDate }
    });

    const totalSales = orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
    const totalGST = orders.reduce((sum, order) => sum + (order.gst || 0), 0);
    const totalSGST = orders.reduce((sum, order) => sum + (order.sgst || 0), 0);
    const totalTax = totalGST + totalSGST;
    const taxableAmount = totalSales - totalTax;

    const monthlyData = [];
    for (let i = 0; i < 12; i++) {
      const monthStart = new Date(now.getFullYear(), i, 1);
      const monthEnd = new Date(now.getFullYear(), i + 1, 0, 23, 59, 59);
      
      const monthOrders = await Order.find({
        createdAt: { $gte: monthStart, $lte: monthEnd }
      });
      
      const sales = monthOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
      const tax = monthOrders.reduce((sum, o) => sum + (o.gst || 0) + (o.sgst || 0), 0);
      
      monthlyData.push({
        month: monthStart.toLocaleDateString('en-US', { month: 'short' }),
        sales,
        tax
      });
    }

    res.json({
      totalSales,
      taxableAmount,
      cgst: totalGST,
      sgst: totalSGST,
      totalTax,
      exemptSales: 0,
      monthlyData
    });
  } catch (error) {
    console.error('Tax report error:', error);
    res.status(500).json({ message: 'Failed to fetch tax data' });
  }
});

module.exports = router;
