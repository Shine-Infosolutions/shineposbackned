const mongoose = require("mongoose");

const MenuItemSchema = new mongoose.Schema({
    itemName: {
        type: String,
        required: true,
        trim: true
    },
    categoryID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'out-of-stock'],
        default: 'active'
    },
    imageUrl: {
        type: String,
        trim: true
    },
    videoUrl: {
        type: String,
        trim: true
    },
    timeToPrepare: {
        type: Number,
        required: true,
        min: 1
    },
    foodType: {
        type: String,
        enum: ['veg', 'nonveg'],
        required: true
    },
    addon: [{ type: mongoose.Schema.Types.ObjectId, ref:'addon'}],
    variation: [{ type: mongoose.Schema.Types.ObjectId, ref:'variations'}],
}, {
    timestamps: true
});

module.exports = mongoose.model('MenuItem', MenuItemSchema);