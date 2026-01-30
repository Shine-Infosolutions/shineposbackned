const express = require('express');
const router = express.Router();
const { getItems, postItems, updateCategoryStatus, updateItemStatus } = require('../controllers/zomatoWebhookController');

router.get('/:resId/items', getItems);
router.post('/:resId/items', postItems);
router.post('/:resId/categories/status', updateCategoryStatus);
router.post('/:resId/items/status', updateItemStatus);

module.exports = router;
