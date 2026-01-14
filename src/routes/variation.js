const express = require('express');
const { body } = require('express-validator');
const auth = require('../middleware/auth');
const tenantMiddleware = require('../middleware/tenant');
const { activityLogger } = require('../middleware/activityLogger');
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
    activityLogger('Variation'),
    [
        body('name').trim().notEmpty().withMessage('Variation name is required'),
        body('price').isNumeric().withMessage('Price must be a number')
    ],
    createVariation
);

// Get all variations
router.get('/all/variation', auth(['RESTAURANT_ADMIN']), tenantMiddleware, activityLogger('Variation'), getVariations);

// Get variation by ID
router.get('/get/variation/:id', auth(['RESTAURANT_ADMIN']), tenantMiddleware, activityLogger('Variation'), getVariationById);

// Update variation
router.put('/update/variation/:id', auth(['RESTAURANT_ADMIN']), tenantMiddleware, activityLogger('Variation'), updateVariation);

// Delete variation
router.delete('/delete/variation/:id', auth(['RESTAURANT_ADMIN']), tenantMiddleware, activityLogger('Variation'), deleteVariation);

module.exports = router;