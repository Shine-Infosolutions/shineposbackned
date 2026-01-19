const express = require('express');
const router = express.Router();
const kotController = require('../controllers/kotController');
const auth = require('../middleware/auth');

// Create KOT from order
router.post('/', auth, kotController.createKOT);

// Get all KOTs with optional filters
router.get('/', auth, kotController.getKOTs);

// Get kitchen dashboard data
router.get('/dashboard', auth, kotController.getKitchenDashboard);

// Get KOT by ID
router.get('/:id', auth, kotController.getKOTById);

// Update KOT status
router.patch('/:id/status', auth(['RESTAURANT_ADMIN', 'MANAGER', 'CHEF', 'WAITER']), kotController.updateKOTStatus);

// Update KOT priority
router.patch('/:id/priority', auth, kotController.updateKOTPriority);

// Print KOT
router.post('/:id/print', auth, kotController.printKOT);

// Delete KOT
router.delete('/:id', auth, kotController.deleteKOT);

module.exports = router;