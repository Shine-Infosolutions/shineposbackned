const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
    },

    items: [
      {
        menuId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Menu",
          required: true,
        },

        name: {
          type: String,
          required: true,
          trim: true,
        },

        basePrice: {
          type: Number,
          required: true,
          min: 0,
        },

        quantity: {
          type: Number,
          required: true,
          min: 1,
        },

        // VARIATION (Size, Type, etc.)
        variation: {
          variationId: {
            type: mongoose.Schema.Types.ObjectId,
          },
          name: {
            type: String,
          },
          price: {
            type: Number,
            min: 0,
          },
        },

        // ADD-ONS (Cheese, Extra Toppings, etc.)
        addons: [
          {
            addonId: {
              type: mongoose.Schema.Types.ObjectId,
            },
            name: {
              type: String,
            },
            price: {
              type: Number,
              min: 0,
            },
          },
        ],

        // FINAL ITEM PRICE
        itemTotal: {
          type: Number,
          required: true,
          min: 0,
        },

        // ITEM STATUS
        status: {
          type: String,
          enum: ["PENDING", "PREPARING", "READY", "SERVED"],
          default: "PENDING",
        },
      },
    ],
    
    extraItems: [
      {
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
      },
    ],

    subtotal: {
      type: Number,
      min: 0,
    },

    discount: {
      percentage: {
        type: Number,
        min: 0,
        max: 100,
      },
      amount: {
        type: Number,
        min: 0,
        default: 0,
      },
      reason: {
        type: String,
        trim: true,
        default: "",
      },
      appliedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Staff",
        default: null,
      },
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    status: {
      type: String,
      enum: [
        "PENDING",
        "ORDER_ACCEPTED",
        "PREPARING",
        "READY",
        "SERVED",
        "COMPLETE",
        "CANCELLED",
      ],
      default: "PENDING",
    },

    priority: {
      type: String,
      enum: ["LOW", "NORMAL", "HIGH", "URGENT"],
      default: "NORMAL",
    },

    customerName: {
      type: String,
      required: true,
      trim: true,
    },

    customerPhone: {
      type: String,
      trim: true,
    },

    tableId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Table",
    },

    tableNumber: {
      type: String,
    },

    mergedTables: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Table",
      },
    ],

    paymentDetails: {
      method: {
        type: String,
        enum: ["CASH", "CARD", "UPI", "ONLINE"],
      },
      amount: {
        type: Number,
        min: 0,
      },
      transactionId: String,
      paidAt: Date,
    },
  },
  { timestamps: true },
);
//updata
module.exports = mongoose.model("Order", OrderSchema);
