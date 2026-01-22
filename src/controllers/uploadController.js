const cloudinary = require('../config/cloudinary');

const uploadMedia = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const isVideo = req.file.mimetype.startsWith('video/');
    
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          resource_type: isVideo ? 'video' : 'image',
          folder: `pos-shine/${req.tenantId}`,
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(req.file.buffer);
    });

    res.json({
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
      type: isVideo ? 'video' : 'image'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteMedia = async (req, res) => {
  try {
    const { publicId } = req.params;
    const { type } = req.query;
    
    await cloudinary.uploader.destroy(publicId, {
      resource_type: type || 'image'
    });
    
    res.json({ success: true, message: 'Media deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  uploadMedia,
  deleteMedia
};