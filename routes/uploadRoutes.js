// routes/upload.js
import express from 'express';
import upload from '../middleware/upload.js';
import { protect } from '../middleware/authMiddleware.js';
import { uploadImageToJournal } from '../controllers/uploadController.js';
import cloudinary from '../utils/cloudinary.js';


const router = express.Router();

router.post('/journal/:id', protect, upload.single('image'), uploadImageToJournal);

// POST /api/upload/profile-image - Upload profile image
router.post('/profile-image', protect, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }

    // Upload to Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'journal-app/profile-images',
          transformation: [
            { width: 400, height: 400, crop: 'fill', gravity: 'face' },
            { quality: 'auto', fetch_format: 'auto' }
          ],
          public_id: `profile_${req.user.id}_${Date.now()}`,
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        }
      );
      
      uploadStream.end(req.file.buffer);
    });

    res.json({
      message: 'Image uploaded successfully',
      imageUrl: uploadResult.secure_url,
      publicId: uploadResult.public_id
    });

  } catch (error) {
    console.error('Image upload error:', error);
    
    if (error.message === 'Only image files are allowed!') {
      return res.status(400).json({ message: error.message });
    }
    
    if (error.message && error.message.includes('File too large')) {
      return res.status(400).json({ message: 'Image file too large. Maximum size is 5MB.' });
    }
    
    res.status(500).json({ 
      message: 'Failed to upload image',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
});

// DELETE /api/upload/profile-image/:publicId - Delete profile image from Cloudinary
router.delete('/profile-image/:publicId', protect, async (req, res) => {
  try {
    const { publicId } = req.params;
    
    // Delete from Cloudinary
    const result = await cloudinary.uploader.destroy(publicId);
    
    if (result.result === 'ok') {
      res.json({ message: 'Image deleted successfully' });
    } else {
      res.status(404).json({ message: 'Image not found or already deleted' });
    }
  } catch (error) {
    console.error('Image deletion error:', error);
    res.status(500).json({ message: 'Failed to delete image' });
  }
});


export default router;

