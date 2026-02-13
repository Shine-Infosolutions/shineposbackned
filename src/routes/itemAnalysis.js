const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getItemAnalysis } = require('../controllers/itemAnalysisController');

router.get('/analysis', auth(), getItemAnalysis);

module.exports = router;
