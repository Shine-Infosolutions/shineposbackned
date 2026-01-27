const express = require('express');
const { body } = require('express-validator');
const auth = require('../middleware/auth');
const tenantMiddleware = require('../middleware/tenant');
const { activityLogger } = require('../middleware/activityLogger');
const {
    createTable,
    getTables,
    getTableById,
    updateTable,
    updateTableStatus,
    deleteTable,
    getAvailableTables,
    transferTable,
    mergeTables,
    getReplacementOptions,
    transferAndMerge
} = require('../controllers/tableController');

const router = express.Router();

router.post('/add/table', auth(['RESTAURANT_ADMIN']), tenantMiddleware, activityLogger('Table'), [
    body('tableNumber').trim().notEmpty().withMessage('Table number is required'),
    body('capacity').isInt({ min: 1 }).withMessage('Capacity must be at least 1')
], createTable);

router.get('/all/table', auth(['RESTAURANT_ADMIN', 'STAFF']), tenantMiddleware, activityLogger('Table'), getTables);
router.get('/tables', auth(['RESTAURANT_ADMIN', 'STAFF', 'MANAGER', 'WAITER', 'CASHIER']), tenantMiddleware, activityLogger('Table'), getTables);
router.get('/tables/available', auth(['RESTAURANT_ADMIN', 'STAFF', 'MANAGER', 'WAITER']), tenantMiddleware, activityLogger('Table'), getAvailableTables);
router.get('/available/table', auth(['RESTAURANT_ADMIN', 'STAFF']), tenantMiddleware, activityLogger('Table'), getAvailableTables);
router.get('/table/:id', auth(['RESTAURANT_ADMIN', 'STAFF']), tenantMiddleware, activityLogger('Table'), getTableById);
router.put('/update/table/:id', auth(['RESTAURANT_ADMIN']), tenantMiddleware, activityLogger('Table'), updateTable);
router.patch('/status/table/:id', auth(['RESTAURANT_ADMIN', 'STAFF']), tenantMiddleware, activityLogger('Table'), [
    body('status').isIn(['AVAILABLE', 'OCCUPIED', 'RESERVED', 'MAINTENANCE']).withMessage('Invalid status')
], updateTableStatus);
router.patch('/tables/:id/status', auth(['RESTAURANT_ADMIN', 'STAFF', 'MANAGER', 'WAITER', 'CASHIER']), tenantMiddleware, activityLogger('Table'), [
    body('status').isIn(['AVAILABLE', 'OCCUPIED', 'RESERVED', 'MAINTENANCE']).withMessage('Invalid status')
], updateTableStatus);
router.delete('/delete/table/:id', auth(['RESTAURANT_ADMIN']), tenantMiddleware, activityLogger('Table'), deleteTable);

router.post('/transfer', auth(['RESTAURANT_ADMIN', 'MANAGER', 'WAITER']), tenantMiddleware, activityLogger('Table Transfer'), [
    body('orderId').isMongoId().withMessage('Valid order ID is required'),
    body('newTableId').isMongoId().withMessage('Valid new table ID is required')
], transferTable);

router.post('/tables/merge', auth(['RESTAURANT_ADMIN', 'MANAGER', 'WAITER']), tenantMiddleware, activityLogger('Table Merge'), [
    body('tableIds').isArray({ min: 2 }).withMessage('At least 2 tables required'),
    body('guestCount').isInt({ min: 1 }).withMessage('Valid guest count required')
], mergeTables);

router.get('/tables/replacement-options/:brokenTableId', auth(['RESTAURANT_ADMIN', 'MANAGER']), tenantMiddleware, activityLogger('Get Replacement Options'), getReplacementOptions);

router.post('/tables/transfer-and-merge', auth(['RESTAURANT_ADMIN', 'MANAGER']), tenantMiddleware, activityLogger('Transfer and Merge'), [
    body('brokenTableId').isMongoId().withMessage('Valid broken table ID is required'),
    body('replacementTableId').isMongoId().withMessage('Valid replacement table ID is required')
], transferAndMerge);

module.exports = router;