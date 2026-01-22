const express = require('express');
const router = express.Router();
const upload = require('../config/multer');
const { uploadMedia, deleteMedia } = require('../controllers/uploadController');
const auth = require('../middleware/auth');
const tenant = require('../middleware/tenant');

router.post('/media', auth, tenant, upload.single('file'), uploadMedia);
router.delete('/media/:publicId', auth, tenant, deleteMedia);

module.exports = router;