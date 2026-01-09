const mongoose = require("mongoose");

const variationSchema = new mongoose.Schema({
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

module.exports = mongoose.model('Variation', variationSchema);