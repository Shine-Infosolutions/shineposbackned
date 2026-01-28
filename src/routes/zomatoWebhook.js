const express = require('express');
const router = express.Router();
const { handleZomatoWebhook } = require('../controllers/zomatoWebhookController');

router.get('/webhook/zomato/:resId/items', (req, res) => {
  res.json({ message: 'Webhook endpoint ready', resId: req.params.resId });
});
router.post('/webhook/zomato/items/:resId', handleZomatoWebhook);

module.exports = router;
