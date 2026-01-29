const express = require('express');
const { getPublicDigitalMenu } = require('../controllers/digitalMenuController');

const router = express.Router();

// Public digital menu endpoint (no auth required)
router.get('/:restaurantSlug', getPublicDigitalMenu);

module.exports = router;