const Discount = require('../models/Discount');
const DiscountUsage = require('../models/DiscountUsage');

// Create discount
exports.createDiscount = async (req, res) => {
  try {
    const discount = new Discount({ ...req.body, restaurantId: req.user.restaurantId, createdBy: req.user._id });
    await discount.save();
    res.status(201).json(discount);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get all discounts
exports.getDiscounts = async (req, res) => {
  try {
    const { type, isActive } = req.query;
    const filter = { restaurantId: req.user.restaurantId };
    if (type) filter.type = type;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    
    const discounts = await Discount.find(filter).sort({ createdAt: -1 });
    res.json(discounts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get discount by ID
exports.getDiscountById = async (req, res) => {
  try {
    const discount = await Discount.findOne({ _id: req.params.id, restaurantId: req.user.restaurantId });
    if (!discount) return res.status(404).json({ error: 'Discount not found' });
    res.json(discount);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update discount
exports.updateDiscount = async (req, res) => {
  try {
    const discount = await Discount.findOneAndUpdate(
      { _id: req.params.id, restaurantId: req.user.restaurantId },
      { ...req.body, updatedBy: req.user._id },
      { new: true, runValidators: true }
    );
    if (!discount) return res.status(404).json({ error: 'Discount not found' });
    res.json(discount);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Delete discount
exports.deleteDiscount = async (req, res) => {
  try {
    const discount = await Discount.findOneAndDelete({ _id: req.params.id, restaurantId: req.user.restaurantId });
    if (!discount) return res.status(404).json({ error: 'Discount not found' });
    res.json({ message: 'Discount deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Validate and apply discount
exports.validateDiscount = async (req, res) => {
  try {
    const { code, customerId, items, orderTotal, employeeId } = req.body;
    
    const discount = await Discount.findOne({ 
      restaurantId: req.user.restaurantId, 
      code: code?.toUpperCase(),
      isActive: true 
    });
    
    if (!discount) return res.status(404).json({ error: 'Invalid discount code' });
    
    const now = new Date();
    if (now < discount.validFrom || now > discount.validUntil) {
      return res.status(400).json({ error: 'Discount has expired or not yet valid' });
    }
    
    // Check usage limits
    if (discount.usageLimit && discount.usageCount >= discount.usageLimit) {
      return res.status(400).json({ error: 'Discount usage limit reached' });
    }
    
    if (discount.perUserLimit && customerId) {
      const userUsage = await DiscountUsage.countDocuments({ discountId: discount._id, customerId });
      if (userUsage >= discount.perUserLimit) {
        return res.status(400).json({ error: 'You have reached the usage limit for this discount' });
      }
    }
    
    // Check minimum order amount
    if (orderTotal < discount.minOrderAmount) {
      return res.status(400).json({ error: `Minimum order amount is ${discount.minOrderAmount}` });
    }
    
    // Type-specific validations
    if (discount.type === 'happy_hour') {
      const isHappyHour = checkHappyHour(discount.timeSlots);
      if (!isHappyHour) return res.status(400).json({ error: 'Not within happy hour time' });
    }
    
    if (discount.type === 'employee') {
      if (!employeeId) return res.status(400).json({ error: 'Employee ID required' });
      if (!discount.allEmployees && !discount.employeeIds.includes(employeeId)) {
        return res.status(400).json({ error: 'Not eligible for employee discount' });
      }
    }
    
    // Calculate discount
    const discountAmount = calculateDiscount(discount, items, orderTotal);
    
    res.json({ 
      valid: true, 
      discount: { 
        id: discount._id, 
        name: discount.name, 
        type: discount.type,
        discountAmount 
      } 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get active discounts for customer
exports.getActiveDiscounts = async (req, res) => {
  try {
    const now = new Date();
    const discounts = await Discount.find({
      restaurantId: req.user.restaurantId,
      isActive: true,
      validFrom: { $lte: now },
      validUntil: { $gte: now },
      type: { $in: ['coupon', 'birthday', 'anniversary'] }
    }).select('name code type discountType value minOrderAmount validUntil');
    
    res.json(discounts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get discount usage statistics
exports.getDiscountStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const filter = { restaurantId: req.user.restaurantId };
    
    if (startDate && endDate) {
      filter.usedAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    
    const stats = await DiscountUsage.aggregate([
      { $match: filter },
      { $group: {
        _id: '$discountId',
        totalUsage: { $sum: 1 },
        totalDiscount: { $sum: '$discountAmount' }
      }},
      { $lookup: {
        from: 'discounts',
        localField: '_id',
        foreignField: '_id',
        as: 'discount'
      }},
      { $unwind: '$discount' },
      { $project: {
        name: '$discount.name',
        code: '$discount.code',
        type: '$discount.type',
        totalUsage: 1,
        totalDiscount: 1
      }}
    ]);
    
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Helper functions
function checkHappyHour(timeSlots) {
  const now = new Date();
  const currentDay = now.getDay();
  const currentTime = now.getHours() * 60 + now.getMinutes();
  
  return timeSlots.some(slot => {
    if (!slot.daysOfWeek.includes(currentDay)) return false;
    const [startHour, startMin] = slot.startTime.split(':').map(Number);
    const [endHour, endMin] = slot.endTime.split(':').map(Number);
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;
    return currentTime >= startTime && currentTime <= endTime;
  });
}

function calculateDiscount(discount, items, orderTotal) {
  let applicableAmount = orderTotal;
  
  // Filter applicable items
  if (!discount.applyToAll && (discount.applicableItems?.length || discount.applicableCategories?.length)) {
    applicableAmount = items.reduce((sum, item) => {
      const isApplicable = discount.applicableItems?.includes(item.itemId) || 
                          discount.applicableCategories?.includes(item.categoryId);
      return sum + (isApplicable ? item.price * item.quantity : 0);
    }, 0);
  }
  
  // Bulk discount
  if (discount.type === 'bulk' && discount.bulkRules?.length) {
    const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);
    const rule = discount.bulkRules
      .filter(r => totalQty >= r.minQuantity)
      .sort((a, b) => b.minQuantity - a.minQuantity)[0];
    if (rule) return (applicableAmount * rule.discountPercentage) / 100;
  }
  
  // Calculate discount
  let discountAmount = discount.discountType === 'percentage' 
    ? (applicableAmount * discount.value) / 100 
    : discount.value;
  
  // Apply max discount cap
  if (discount.maxDiscountAmount) {
    discountAmount = Math.min(discountAmount, discount.maxDiscountAmount);
  }
  
  return Math.round(discountAmount * 100) / 100;
}
