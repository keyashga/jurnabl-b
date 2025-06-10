import Journal from '../models/journalModel.js';
import User from '../models/userModel.js';
import cloudinary from '../utils/cloudinary.js';
import streamifier from 'streamifier';


// GET /api/journals
export const getAllJournals = async (req, res) => {
  try {
    const userId = req.user._id;

    const journals = await Journal.find({
      $or: [
        { author: userId },
        { visibility: 'public' },
        {
          visibility: 'close-friends',
          author: { $in: req.user.closeFriends || [] },
        },
      ],
    }).sort({ createdAt: -1 });

    res.json(journals);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch journals', error });
  }
};

// GET /api/journals/:id
export const getJournalById = async (req, res) => {
  try {
    const journal = await Journal.findById(req.params.id).populate('author', 'name profileImage');

    if (!journal) return res.status(404).json({ message: 'Journal not found' });

    const isAuthor = journal.author._id.equals(req.user._id);
    const isCloseFriend = req.user.closeFriends?.includes(journal.author._id.toString());

    const canView =
      isAuthor ||
      journal.visibility === 'public' ||
      (journal.visibility === 'close-friends' && isCloseFriend);

    if (!canView) return res.status(403).json({ message: 'Access denied' });

    res.json(journal);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch journal', error });
  }
};


// DELETE /api/journals/:id
export const deleteJournal = async (req, res) => {
  try {
    const journal = await Journal.findById(req.params.id);

    if (!journal) return res.status(404).json({ message: 'Journal not found' });
    if (!journal.author.equals(req.user._id))
      return res.status(403).json({ message: 'Not authorized to delete this journal' });

    await journal.deleteOne();
    res.json({ message: 'Journal deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete journal', error });
  }
};


// GET /api/journals/user/:userId
export const getJournalsByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id.toString();

    const isOwnProfile = currentUserId === userId;

    let visibilityFilter = { visibility: 'public' };

    if (!isOwnProfile) {
      const author = await User.findById(userId).select('closeFriends');
      const isCloseFriend = author?.closeFriends.includes(currentUserId);

      visibilityFilter = {
        $or: [
          { visibility: 'public' },
          ...(isCloseFriend ? [{ visibility: 'close-friends' }] : []),
        ],
      };
    }

    const journals = await Journal.find({
      author: userId,
      ...(isOwnProfile ? {} : visibilityFilter),
    }).sort({ createdAt: -1 });

    res.json(journals);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch user journals', error });
  }
};

// GET /api/journals/date/:date
export const getJournalByDate = async (req, res) => {
  try {
    const { date } = req.params; // Expected format: YYYY-MM-DD
    const userId = req.user._id;

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({ 
        message: 'Invalid date format. Use YYYY-MM-DD format' 
      });
    }

    // Find journal for the specific date and user
    const journal = await Journal.findOne({
      author: userId,
      journaldate: date
    }).populate('author', 'name profileImage');

    if (!journal) {
      return res.status(404).json({ 
        message: 'No journal found for this date' 
      });
    }

    res.json(journal);
  } catch (error) {
    console.error('Get journal by date error:', error);
    res.status(500).json({ 
      message: 'Failed to fetch journal for this date', 
      error: error.message 
    });
  }
};

// PUT /api/journals/:id - Enhanced Update Journal Controller
export const updateJournal = async (req, res) => {
  try {
    const { title, content, visibility, isAnonymous, removeImage } = req.body;
    const journalId = req.params.id;

    // Find the journal
    const journal = await Journal.findById(journalId);

    if (!journal) {
      return res.status(404).json({ message: 'Journal not found' });
    }

    // Check if the user is the author
    if (!journal.author.equals(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized to update this journal' });
    }

    // Validate required fields
    if (!title || !content) {
      return res.status(400).json({ 
        message: 'Title and content are required' 
      });
    }

    // Update basic fields
    journal.title = title.trim();
    journal.content = content.trim();
    journal.visibility = visibility || journal.visibility;
    journal.isAnonymous = isAnonymous !== undefined ? isAnonymous : journal.isAnonymous;
    journal.updatedAt = new Date();

    // Handle image removal
    if (removeImage === 'true' || removeImage === true) {
      journal.images = [];
    }
    // Handle new image upload
    else if (req.file) {
      try {
        // Upload new image to Cloudinary
        const result = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: 'journals' },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          streamifier.createReadStream(req.file.buffer).pipe(stream);
        });

        // Replace existing image with new one
        journal.images = [result.secure_url];

      } catch (cloudinaryError) {
        console.error('Cloudinary upload error:', cloudinaryError);
        return res.status(500).json({ 
          message: 'Failed to upload image', 
          error: cloudinaryError.message 
        });
      }
    }

    const updatedJournal = await journal.save();
    
    return res.status(200).json({
      message: 'Journal updated successfully',
      journal: updatedJournal
    });

  } catch (error) {
    console.error('Update journal error:', error);
    res.status(500).json({ 
      message: 'Failed to update journal', 
      error: error.message 
    });
  }
};


// POST /api/journals
export const createJournal = async (req, res) => {
  try {
    const { title, content, visibility, isAnonymous, journaldate } = req.body;
    
    // Validate required fields
    if (!title || !content || !journaldate) {
      return res.status(400).json({ 
        message: 'Title, content, and journal date are required' 
      });
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(journaldate)) {
      return res.status(400).json({ 
        message: 'Invalid date format. Use YYYY-MM-DD format' 
      });
    }

    // Check if journal already exists for this date
    const existingJournal = await Journal.findOne({
      author: req.user._id,
      journaldate: journaldate
    });

    if (existingJournal) {
      return res.status(409).json({ 
        message: 'Journal entry already exists for this date. Please update the existing entry.' 
      });
    }

    if (req.file) {
      const result = await cloudinary.uploader.upload_stream(
        { folder: 'journals' },
        async (error, result) => {
          if (error) {
            return res.status(500).json({ message: 'Cloudinary upload failed', error });
          }

          const journal = new Journal({
            author: req.user._id,
            title,
            content,
            images: [result.secure_url],
            visibility,
            isAnonymous,
            journaldate, // Add the journal date
          });

          const saved = await journal.save();
          res.status(201).json(saved);
        }
      );

      // Important: stream buffer to Cloudinary
      result.end(req.file.buffer);
    } else {
      // No image uploaded
      const journal = new Journal({
        author: req.user._id,
        title,
        content,
        images: [],
        visibility,
        isAnonymous,
        journaldate, // Add the journal date
      });

      const saved = await journal.save();
      res.status(201).json(saved);
    }
  } catch (error) {
    console.error('Create journal error:', error);
    res.status(500).json({ message: 'Failed to create journal', error: error.message });
  }
};


