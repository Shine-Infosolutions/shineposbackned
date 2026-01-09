const express = require('express');
const { body } = require('express-validator');
const auth = require('../middleware/auth');
const tenantMiddleware = require('../middleware/tenant');
const {
    createVariation,
    getVariations,
    getVariationById,
    updateVariation,
    deleteVariation
} = require('../controllers/variationController');

const router = express.Router();

// Create Variation
router.post(
    '/add/variation',
    auth(['RESTAURANT_ADMIN']),
    tenantMiddleware,
    [
        body('name').trim().notEmpty().withMessage('Variation name is required'),
        body('price').isNumeric().withMessage('Price must be a number')
    ],
    createVariation
);

// Get all variations
router.get('/all/variation', auth(['RESTAURANT_ADMIN']), tenantMiddleware, getVariations);

// Get variation by ID
router.get('/get/variation/:id', auth(['RESTAURANT_ADMIN']), tenantMiddleware, getVariationById);

// Update variation
router.put('/update/variation/:id', auth(['RESTAURANT_ADMIN']), tenantMiddleware, updateVariation);

// Delete variation
router.delete('/delete/variation/:id', auth(['RESTAURANT_ADMIN']), tenantMiddleware, deleteVariation);

module.exports = router;