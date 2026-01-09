const express = require('express');
const { body } = require('express-validator');
const auth = require('../middleware/auth');
const tenantMiddleware = require('../middleware/tenant');
const {
    createAddon,
    getAddons,
    getAddonById,
    updateAddon,
    deleteAddon
} = require('../controllers/addonController');

const router = express.Router();

// Create Addon
router.post(
    '/add/addon',
    auth(['RESTAURANT_ADMIN']),
    tenantMiddleware,
    [
        body('name').trim().notEmpty().withMessage('Addon name is required'),
        body('price').isNumeric().withMessage('Price must be a number')
    ],
    createAddon
);

// Get all addons
router.get('/all/addon', auth(['RESTAURANT_ADMIN']), tenantMiddleware, getAddons);

// Get addon by ID
router.get('/get/addon/:id', auth(['RESTAURANT_ADMIN']), tenantMiddleware, getAddonById);

// Update addon
router.put('/update/addon/:id', auth(['RESTAURANT_ADMIN']), tenantMiddleware, updateAddon);

// Delete addon
router.delete('/delete/addon/:id', auth(['RESTAURANT_ADMIN']), tenantMiddleware, deleteAddon);

module.exports = router;