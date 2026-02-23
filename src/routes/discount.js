const express = require('express');
const router = express.Router();
const discountController = require('../controllers/discountController');
const auth = require('../middleware/auth');

router.post('/', auth(['RESTAURANT_ADMIN', 'MANAGER']), discountController.createDiscount);
router.get('/', auth(['RESTAURANT_ADMIN', 'MANAGER']), discountController.getDiscounts);
router.get('/active', auth(), discountController.getActiveDiscounts);
router.get('/stats', auth(['RESTAURANT_ADMIN', 'MANAGER']), discountController.getDiscountStats);
router.post('/validate', auth(), discountController.validateDiscount);
router.get('/:id', auth(['RESTAURANT_ADMIN', 'MANAGER']), discountController.getDiscountById);
router.put('/:id', auth(['RESTAURANT_ADMIN', 'MANAGER']), discountController.updateDiscount);
router.delete('/:id', auth(['RESTAURANT_ADMIN', 'MANAGER']), discountController.deleteDiscount);

module.exports = router;
