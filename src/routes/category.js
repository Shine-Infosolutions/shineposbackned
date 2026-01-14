const express = require('express');
const { body } = require('express-validator');
const auth = require('../middleware/auth');
const tenantMiddleware = require('../middleware/tenant');
const { activityLogger } = require('../middleware/activityLogger');
const {
    createCategory,
    getCategories,
    updateCategory,
    deleteCategory
} = require('../controllers/categoryController');

const router = express.Router();

router.post('/add/category', auth(['RESTAURANT_ADMIN']), tenantMiddleware, activityLogger('Category'), [
    body('name').trim().notEmpty().withMessage('Category name is required')
], createCategory);
router.get('/all/category', auth(['RESTAURANT_ADMIN']), tenantMiddleware, activityLogger('Category'), getCategories);
router.put('/update/category/:id', auth(['RESTAURANT_ADMIN']), tenantMiddleware, activityLogger('Category'), updateCategory);
router.delete('/delete/category/:id', auth(['RESTAURANT_ADMIN']), tenantMiddleware, activityLogger('Category'), deleteCategory);

module.exports = router;
