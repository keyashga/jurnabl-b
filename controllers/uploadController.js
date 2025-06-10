import cloudinary from '../utils/cloudinary.js';
import streamifier from 'streamifier';
import Journal from '../models/journalModel.js';

export const uploadImageToJournal = async (req, res) => {
  try {
    const journalId = req.params.id;
    if (!journalId) {
      return res.status(400).json({ message: 'Journal ID is required' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }

    const streamUpload = (fileBuffer) => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'journal_app_entries' },
          (error, result) => {
            if (result) {
              resolve(result);
            } else {
              reject(error);
            }
          }
        );
        streamifier.createReadStream(fileBuffer).pipe(stream);
      });
    };

    const result = await streamUpload(req.file.buffer);

    // Attach image URL to journal entry
    const journal = await Journal.findOne({ _id: journalId, author: req.user.id });

    if (!journal) {
      return res.status(404).json({ message: 'Journal not found or not authorized' });
    }

    journal.images.push(result.secure_url);
    await journal.save();

    res.status(200).json({
      message: 'Image uploaded and added to journal successfully',
      imageUrl: result.secure_url,
    });
  } catch (error) {
    res.status(500).json({ message: 'Upload failed', error: error.message });
  }
};
