const express = require('express');
const router = express.Router();
const { syncDynoOrders } = require('../controllers/dynoOrderController');
const auth = require('../middleware/auth');

router.post('/sync-orders', auth(['RESTAURANT_ADMIN']), syncDynoOrders);

module.exports = router;
