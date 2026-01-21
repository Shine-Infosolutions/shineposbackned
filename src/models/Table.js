const mongoose = require("mongoose");

const TableSchema = new mongoose.Schema(
  {
    tableNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    capacity: {
      type: Number,
      required: true,
      min: 1,
    },

    location: {
      type: String,
      enum: ["INDOOR"],
      default: "INDOOR",
    },

    status: {
      type: String,
      enum: ["AVAILABLE", "OCCUPIED", "RESERVED", "MAINTENANCE"],
      default: "AVAILABLE",
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    mergedWith: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'Table',
      default: []
    },

    mergedGuestCount: {
      type: Number,
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Table", TableSchema);