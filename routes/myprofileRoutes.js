// routes/users.js (or wherever your user routes are)
import express from 'express';
import User from '../models/userModel.js';
import { protect } from '../middleware/authMiddleware.js'; // Your auth middleware
import Journal from '../models/journalModel.js';

const router = express.Router();


// Add this route to your routes file
router.get('/mystats', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get all journals for the user
    const journals = await Journal.find({ author: userId });
    
    // Calculate total likes and reads
    const totalLikes = journals.reduce((sum, journal) => sum + (journal.likesCount || 0), 0);
    const totalReads = journals.reduce((sum, journal) => sum + (journal.readsCount || 0), 0);
    
    // Calculate consistency
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    
    // Get unique dates when user wrote journals in last 30 days
    const recentJournalDates = journals
      .filter(journal => new Date(journal.createdAt) >= thirtyDaysAgo)
      .map(journal => new Date(journal.createdAt).toDateString())
      .filter((date, index, array) => array.indexOf(date) === index);
    
    const consistency = Math.round((recentJournalDates.length / 30) * 100);
    
    res.json({
      totalLikes,
      totalReads,
      consistency,
      journalsCount: journals.length,
      recentActivity: recentJournalDates.length
    });
    
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      message: 'Server error while fetching stats',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update user stats
router.put('/:userId/stats', protect, async (req, res) => {
  try {
    const { userId } = req.params;

    // Verify the user is updating their own stats or has admin privileges
    if (req.user.id !== userId) {
      return res.status(403).json({ message: 'Not authorized to update these stats' });
    }

    // Calculate stats from user's journals
    const journals = await Journal.find({ author: userId });
    
    // Sum up likes and reads from all journals
    const totalLikes = journals.reduce((sum, journal) => sum + (journal.likesCount || 0), 0);
    const totalReads = journals.reduce((sum, journal) => sum + (journal.readsCount || 0), 0);
    
    // Set consistency to 100 for now (you can implement actual logic later)
    const consistency = 100;

    // Update user stats
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        totalLikes,
        totalReads,
        consistency
      },
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: 'Stats updated successfully',
      user: updatedUser,
      stats: {
        totalLikes,
        totalReads,
        consistency,
        journalsCount: journals.length
      }
    });

  } catch (error) {
    console.error('Error updating user stats:', error);
    res.status(500).json({
      message: 'Server error while updating stats',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get user journals (if you don't have this endpoint already)
router.get('/journals/:userId', protect, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Import Journal model
    const Journal = (await import('../models/Journal.js')).default;
    
    const journals = await Journal.find({ author: userId })
      .sort({ createdAt: -1 })
      .populate('author', 'name username profileImage');

    res.json(journals);

  } catch (error) {
    console.error('Error fetching user journals:', error);
    res.status(500).json({ message: 'Server error while fetching journals' });
  }
});


// PUT /api/myprofile - Update current user's profile
router.put('/', protect, async (req, res) => {
  try {
    const { name, username, bio, location, profileImage } = req.body;
    
    // Validation
    if (!name || !username) {
      return res.status(400).json({ message: 'Name and username are required' });
    }

    // Check if username is already taken by another user
    if (username !== req.user.username) {
      const existingUser = await User.findOne({ username, _id: { $ne: req.user.id } });
      if (existingUser) {
        return res.status(400).json({ message: 'Username is already taken' });
      }
    }

    // Bio length validation
    if (bio && bio.length > 500) {
      return res.status(400).json({ message: 'Bio cannot exceed 500 characters' });
    }

    // Prepare update object
    const updateData = {
      name: name.trim(),
      username: username.trim().toLowerCase(),
      bio: bio ? bio.trim() : '',
      location: location ? location.trim() : ''
    };

    // Only update profileImage if it's provided
    if (profileImage !== undefined) {
      updateData.profileImage = profileImage ? profileImage.trim() : '';
    }

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Return updated profile in the same format as GET request
    const userProfile = {
      name: updatedUser.name,
      username: updatedUser.username,
      email: updatedUser.email,
      profileImage: updatedUser.profileImage,
      bio: updatedUser.bio,
      location: updatedUser.location,
      totalLikes: updatedUser.totalLikes,
      totalReads: updatedUser.totalReads,
      consistency: updatedUser.consistency,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt
    };

    res.json(userProfile);
  } catch (error) {
    console.error('Error updating user profile:', error);
    
    // Handle specific MongoDB errors
    if (error.code === 11000) {
      // Duplicate key error
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ 
        message: `${field.charAt(0).toUpperCase() + field.slice(1)} is already taken` 
      });
    }
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    
    res.status(500).json({ message: 'Server error' });
  }
});


router.get('/', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user data
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Calculate stats from journals
    const journals = await Journal.find({ author: userId });
    
    // Sum up likes and reads from all journals
    const totalLikes = journals.reduce((sum, journal) => sum + (journal.likesCount || 0), 0);
    const totalReads = journals.reduce((sum, journal) => sum + (journal.readsCount || 0), 0);
    
    // Calculate consistency (you can implement your own logic here)
    // For now, let's calculate based on recent writing activity
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentJournals = journals.filter(journal => 
      new Date(journal.createdAt) >= thirtyDaysAgo
    );
    
    // Simple consistency calculation: percentage of days with at least one journal in last 30 days
    const consistency = Math.min(100, Math.round((recentJournals.length / 30) * 100));

    // Return user data with calculated stats
    const userWithStats = {
      ...user.toObject(),
      totalLikes,
      totalReads,
      consistency,
      journalsCount: journals.length
    };

    res.json(userWithStats);

  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({
      message: 'Server error while fetching profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;