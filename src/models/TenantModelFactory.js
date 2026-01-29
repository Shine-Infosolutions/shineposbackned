const mongoose = require('mongoose');

// User Schema for tenant-specific collections
const createUserSchema = () => new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['MANAGER', 'CHEF', 'WAITER', 'CASHIER'],
    required: true
  },
  permissions: [{
    type: String,
    enum: ['orders', 'menus', 'inventory', 'staff', 'reports', 'kitchen']
  }],
  phone: String,
  shift: {
    type: String,
    enum: ['MORNING', 'AFTERNOON', 'EVENING', 'NIGHT'],
    default: 'MORNING'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Menu Schema for tenant-specific collections
const createMenuSchema = () => new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: String,
  price: {
    type: Number,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  image: {
    url: String,
    publicId: String
  },
  video: {
    url: String,
    publicId: String
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Order Schema for tenant-specific collections
const createOrderSchema = () => new mongoose.Schema({
  orderNumber: {
    type: String,
    required: true,
    unique: true
  },
  tableId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'tables'
  },
  tableNumber: {
    type: String
  },
  mergedTables: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'tables'
  }],
  items: [{
    menuId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    name: String,
    basePrice: Number,
    quantity: Number,
    variation: {
      variationId: mongoose.Schema.Types.ObjectId,
      name: String,
      price: Number
    },
    addons: [{
      addonId: mongoose.Schema.Types.ObjectId,
      name: String,
      price: Number
    }],
    itemTotal: Number
  }],
  // extraItems
  extraItems: [{
    name: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
  }],
  totalAmount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED', 'PAID'],
    default: 'PENDING'
  },
  priority: {
    type: String,
    enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'],
    default: 'NORMAL'
  },
  customerName: String,
  customerPhone: String,
  paymentDetails: {
    method: String,
    amount: Number,
    transactionId: String,
    paidAt: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Inventory Schema for tenant-specific collections
const createInventorySchema = () => new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['ingredient', 'beverage', 'packaging', 'other']
  },
  currentStock: {
    type: Number,
    required: true,
    min: 0
  },
  minStock: {
    type: Number,
    required: true,
    min: 0
  },
  unit: {
    type: String,
    required: true,
    enum: ['kg', 'g', 'l', 'ml', 'pieces', 'boxes']
  },
  costPerUnit: {
    type: Number,
    required: true,
    min: 0
  },
  supplier: {
    type: String,
    trim: true
  },
  lastRestocked: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Addon Schema for tenant-specific collections
const createAddonSchema = () => new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  description: {
    type: String
  },
  veg: {
    type: Boolean,
    default: true
  },
  available: {
    type: Boolean,
    default: true
  }
});

// Variation Schema for tenant-specific collections
const createVariationSchema = () => new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  price: {
    type: Number,
    required: true
  },
  available: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});
const createStaffSchema = () => new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['MANAGER', 'CHEF', 'WAITER', 'CASHIER'],
    required: true
  },
  permissions: [{
    type: String,
    enum: ['orders', 'menus', 'inventory', 'staff', 'reports', 'kitchen']
  }],
  phone: String,
  hourlyRate: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  shifts: [{
    date: Date,
    startTime: String,
    endTime: String,
    status: {
      type: String,
      enum: ['scheduled', 'completed', 'missed'],
      default: 'scheduled'
    }
  }],
  performance: {
    ordersProcessed: { type: Number, default: 0 },
    averageOrderTime: { type: Number, default: 0 },
    customerRating: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// Attendance Schema for tenant-specific collections
const createAttendanceSchema = () => new mongoose.Schema({
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'staff',
    required: true
  },
  date: {
    type: Date,
    required: true,
    validate: {
      validator: function(value) {
        // Prevent future dates (allow current date)
        const today = new Date();
        today.setHours(23, 59, 59, 999); // End of today
        return value <= today;
      },
      message: 'Attendance date cannot be in the future'
    }
  },
  checkIn: {
    type: Date,
    validate: {
      validator: function(value) {
        if (!value) return true; // Optional field
        // Check-in should be on the same date as attendance date
        const attendanceDate = new Date(this.date);
        const checkInDate = new Date(value);
        return attendanceDate.toDateString() === checkInDate.toDateString();
      },
      message: 'Check-in time must be on the same date as attendance date'
    }
  },
  checkOut: {
    type: Date,
    validate: {
      validator: function(value) {
        if (!value) return true; // Optional field
        // Check-out should be after check-in
        if (this.checkIn && value <= this.checkIn) {
          return false;
        }
        return true;
      },
      message: 'Check-out time must be after check-in time'
    }
  },
  status: {
    type: String,
    enum: ['present', 'absent', 'late', 'half-day', 'on-leave'],
    default: 'absent'
  },
  workingHours: {
    type: Number,
    default: 0
  },
  location: {
    type: String
  },
  modifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'staff'
  }
}, {
  timestamps: true
});

// Table Schema for tenant-specific collections
const createTableSchema = () => new mongoose.Schema({
  tableNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  capacity: {
    type: Number,
    required: true,
    min: 1
  },
  location: {
    type: String,
    enum: ['INDOOR'],
    default: 'INDOOR'
  },
  status: {
    type: String,
    enum: ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'MAINTENANCE'],
    default: 'AVAILABLE'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  mergedWith: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'tables',
    default: []
  },
  mergedGuestCount: {
    type: Number,
    default: null
  }
}, {
  timestamps: true
});

// TableBooking Schema for tenant-specific collections
const createTableBookingSchema = () => {
  const schema = new mongoose.Schema({
    bookingNumber: {
      type: String,
      required: true,
      unique: true
    },
    tableId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'tables',
      required: true
    },
    customerName: {
      type: String,
      required: true,
      trim: true
    },
    customerPhone: {
      type: String,
      required: true,
      trim: true
    },
    customerEmail: {
      type: String,
      trim: true,
      lowercase: true
    },
    partySize: {
      type: Number,
      required: true,
      min: 1
    },
    bookingDate: {
      type: Date,
      required: true
    },
    bookingTime: {
      type: String,
      required: true
    },
    duration: {
      type: Number,
      default: 120
    },
    status: {
      type: String,
      enum: ['PENDING', 'CONFIRMED', 'SEATED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'],
      default: 'PENDING'
    },
    specialRequests: {
      type: String,
      trim: true
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'orders'
    }
  }, {
    timestamps: true
  });
  
  // Generate booking number before saving
  schema.pre('save', async function(next) {
    if (!this.bookingNumber) {
      const count = await this.constructor.countDocuments();
      this.bookingNumber = `BK${String(count + 1).padStart(6, '0')}`;
    }
    next();
  });
  
  return schema;
};

// KOT Schema for tenant-specific collections
const createKOTSchema = () => {
  const schema = new mongoose.Schema({
    kotNumber: {
      type: String,
      unique: true
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    orderNumber: {
      type: String,
      required: true
    },
    items: [{
      menuId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
      },
      name: {
        type: String,
        required: true
      },
      quantity: {
        type: Number,
        required: true,
        min: 1
      },
      variation: {
        name: String,
        price: Number
      },
      addons: [{
        name: String,
        price: Number
      }],
      specialInstructions: String,
      status: {
        type: String,
        enum: ['PENDING', 'PREPARING', 'READY', 'SERVED'],
        default: 'PENDING'
      }
    }],
    extraItems: [{
      menuId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
      },
      name: {
        type: String,
        required: true
      },
      quantity: {
        type: Number,
        required: true,
        min: 1
      },
      variation: {
        name: String,
        price: Number
      },
      addons: [{
        name: String,
        price: Number
      }],
      status: {
        type: String,
        enum: ['PENDING', 'PREPARING', 'READY', 'SERVED'],
        default: 'PENDING'
      }
    }],
    status: {
      type: String,
      enum: ['PENDING', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED', 'PAID'],
      default: 'PENDING'
    },
    priority: {
      type: String,
      enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'],
      default: 'NORMAL'
    },
    tableNumber: String,
    customerName: String,
    printedAt: Date,
    startedAt: Date,
    completedAt: Date,
    estimatedTime: Number,
    actualTime: Number,
    notes: String
  }, {
    timestamps: true
  });
  
  // Generate KOT number before saving
  schema.pre('save', async function(next) {
    if (!this.kotNumber) {
      const count = await this.constructor.countDocuments();
      this.kotNumber = `KOT${String(count + 1).padStart(6, '0')}`;
    }
    next();
  });
  
  return schema;
};

class TenantModelFactory {
  constructor() {
    this.connections = new Map();
    this.models = new Map();
  }

  getTenantConnection(restaurantSlug) {
    if (!this.connections.has(restaurantSlug)) {
      const dbName = `restaurant_${restaurantSlug}`;
      const connection = mongoose.createConnection(process.env.MONGODB_URI.replace('/restaurant-saas', `/${dbName}`));
      this.connections.set(restaurantSlug, connection);
    }
    return this.connections.get(restaurantSlug);
  }

  getUserModel(restaurantSlug) {
    const modelKey = `${restaurantSlug}_users`;
    if (!this.models.has(modelKey)) {
      const connection = this.getTenantConnection(restaurantSlug);
      this.models.set(modelKey, connection.model('users', createUserSchema()));
    }
    return this.models.get(modelKey);
  }

  getMenuModel(restaurantSlug) {
    const modelKey = `${restaurantSlug}_menus`;
    if (!this.models.has(modelKey)) {
      const connection = this.getTenantConnection(restaurantSlug);
      this.models.set(modelKey, connection.model('menus', createMenuSchema()));
    }
    return this.models.get(modelKey);
  }

  getOrderModel(restaurantSlug) {
    const modelKey = `${restaurantSlug}_orders`;
    if (!this.models.has(modelKey)) {
      const connection = this.getTenantConnection(restaurantSlug);
      this.models.set(modelKey, connection.model('orders', createOrderSchema()));
    }
    return this.models.get(modelKey);
  }

  getInventoryModel(restaurantSlug) {
    const modelKey = `${restaurantSlug}_inventory`;
    if (!this.models.has(modelKey)) {
      const connection = this.getTenantConnection(restaurantSlug);
      this.models.set(modelKey, connection.model('inventory', createInventorySchema()));
    }
    return this.models.get(modelKey);
  }

  getMenuItemModel(restaurantSlug) {
    const modelKey = `${restaurantSlug}_menuitems`;
    if (!this.models.has(modelKey)) {
      const connection = this.getTenantConnection(restaurantSlug);
      const menuItemSchema = new mongoose.Schema({
        itemName: { type: String, required: true, trim: true },
        categoryID: { type: mongoose.Schema.Types.ObjectId, ref: 'categories', required: true },
        status: { type: String, enum: ['active', 'inactive'], default: 'active' },
        imageUrl: { type: String },
        videoUrl: { type: String },
        timeToPrepare: { type: Number, required: true },
        foodType: { type: String, enum: ['veg', 'non-veg'], required: true }
      }, { timestamps: true });
      this.models.set(modelKey, connection.model('menuitems', menuItemSchema));
    }
    return this.models.get(modelKey);
  }

  getCategoryModel(restaurantSlug) {
    const modelKey = `${restaurantSlug}_categories`;
    if (!this.models.has(modelKey)) {
      const connection = this.getTenantConnection(restaurantSlug);
      const categorySchema = new mongoose.Schema({
        name: { type: String, required: true, trim: true },
        description: { type: String, trim: true },
        isActive: { type: Boolean, default: true }
      }, { timestamps: true });
      this.models.set(modelKey, connection.model('categories', categorySchema));
    }
    return this.models.get(modelKey);
  }

  getMenuItemModel(restaurantSlug) {
    const modelKey = `${restaurantSlug}_menuitems`;
    if (!this.models.has(modelKey)) {
      const connection = this.getTenantConnection(restaurantSlug);
      const menuItemSchema = new mongoose.Schema({
        itemName: { type: String, required: true, trim: true },
        categoryID: { type: mongoose.Schema.Types.ObjectId, ref: 'categories', required: true },
        status: { type: String, enum: ['active', 'inactive', 'out-of-stock'], default: 'active' },
        imageUrl: { type: String, trim: true },
        videoUrl: { type: String, trim: true },
        timeToPrepare: { type: Number, required: true, min: 1 },
        foodType: { type: String, enum: ['veg', 'nonveg', 'egg'], required: true },
        variation: [{ type: mongoose.Schema.Types.ObjectId, ref: 'variations' }],
        addon: [{ type: mongoose.Schema.Types.ObjectId, ref: 'addons' }]
      }, { 
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
      });
      
      menuItemSchema.virtual('isAvailable').get(function() {
        return this.status === 'active';
      });
      
      this.models.set(modelKey, connection.model('menuitems', menuItemSchema));
    }
    return this.models.get(modelKey);
  }

  getStaffModel(restaurantSlug) {
    const modelKey = `${restaurantSlug}_staff`;
    if (!this.models.has(modelKey)) {
      const connection = this.getTenantConnection(restaurantSlug);
      this.models.set(modelKey, connection.model('staff', createStaffSchema()));
    }
    return this.models.get(modelKey);
  }

  getAddonModel(restaurantSlug) {
    const modelKey = `${restaurantSlug}_addons`;
    if (!this.models.has(modelKey)) {
      const connection = this.getTenantConnection(restaurantSlug);
      this.models.set(modelKey, connection.model('addons', createAddonSchema()));
    }
    return this.models.get(modelKey);
  }

  getVariationModel(restaurantSlug) {
    const modelKey = `${restaurantSlug}_variations`;
    if (!this.models.has(modelKey)) {
      const connection = this.getTenantConnection(restaurantSlug);
      const variationSchema = new mongoose.Schema({
        variantId: { type: String, unique: true, sparse: true },
        catalogueId: String,
        name: { type: String, required: true, trim: true },
        price: { type: Number, required: true },
        basePrice: Number,
        historyPrice: Number,
        maxAllowedPrice: Number,
        available: { type: Boolean, default: true },
        inStock: { type: Boolean, default: true },
        vendorEntityId: String,
        lastSyncedAt: Date
      }, { timestamps: true, strict: false });
      this.models.set(modelKey, connection.model('variations', variationSchema));
    }
    return this.models.get(modelKey);
  }

  getKOTModel(restaurantSlug) {
    const modelKey = `${restaurantSlug}_kots`;
    if (!this.models.has(modelKey)) {
      const connection = this.getTenantConnection(restaurantSlug);
      const kotSchema = createKOTSchema();
      this.models.set(modelKey, connection.model('kots', kotSchema));
    }
    return this.models.get(modelKey);
  }

  getAttendanceModel(restaurantSlug) {
    const modelKey = `${restaurantSlug}_attendance`;
    if (!this.models.has(modelKey)) {
      const connection = this.getTenantConnection(restaurantSlug);
      const attendanceSchema = createAttendanceSchema();
      attendanceSchema.index({ staffId: 1, date: 1 }, { unique: true });
      attendanceSchema.index({ date: 1 });
      this.models.set(modelKey, connection.model('attendance', attendanceSchema));
    }
    return this.models.get(modelKey);
  }

  getTableModel(restaurantSlug) {
    const modelKey = `${restaurantSlug}_tables`;
    if (!this.models.has(modelKey)) {
      const connection = this.getTenantConnection(restaurantSlug);
      this.models.set(modelKey, connection.model('tables', createTableSchema()));
    }
    return this.models.get(modelKey);
  }

  getTableBookingModel(restaurantSlug) {
    const modelKey = `${restaurantSlug}_tablebookings`;
    if (!this.models.has(modelKey)) {
      const connection = this.getTenantConnection(restaurantSlug);
      const tableBookingSchema = createTableBookingSchema();
      this.models.set(modelKey, connection.model('tablebookings', tableBookingSchema));
    }
    return this.models.get(modelKey);
  }

  async createTenantDatabase(restaurantSlug) {
    // Initialize models to create database and collections
    this.getUserModel(restaurantSlug);
    this.getMenuModel(restaurantSlug);
    this.getOrderModel(restaurantSlug);
    this.getInventoryModel(restaurantSlug);
    this.getStaffModel(restaurantSlug);
    this.getCategoryModel(restaurantSlug);
    this.getMenuItemModel(restaurantSlug);
    this.getAddonModel(restaurantSlug);
    this.getVariationModel(restaurantSlug);
    this.getKOTModel(restaurantSlug);
    this.getTableModel(restaurantSlug);
    this.getTableBookingModel(restaurantSlug);
    this.getAttendanceModel(restaurantSlug);
  }
}

module.exports = new TenantModelFactory();