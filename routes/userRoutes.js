// routes/userRoutes.js
import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
const router = express.Router();
import User from '../models/userModel.js';
import Journal from '../models/journalModel.js';

// Get user profile by ID
router.get('/:userId', protect, async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Find user by ID and exclude sensitive information
    const user = await User.findById(userId)
      .select('-password -email -__v') // Exclude sensitive fields
      .lean();

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'The requested user profile does not exist'
      });
    }

    // Get additional stats
    const [journalCount, followersCount, followingCount] = await Promise.all([
      // Count user's public journals (not private)
      Journal.countDocuments({
        author: userId,
        visibility: { $ne: 'private' } // Not private means public or close-circle
      }),
      
      // Count followers - using readers array length
      user.readers ? user.readers.length : 0,
      
      // Count following - you'll need to count how many users have this user in their readers
      User.countDocuments({ readers: userId })
    ]);

    // Transform user object to match frontend expectations
    const userProfile = {
      ...user,
      fullName: user.name, // Map name to fullName for frontend
      avatar: user.profileImage, // Map profileImage to avatar for frontend
      profilePicture: user.profileImage, // Also provide profilePicture as backup
      journalCount,
      followersCount,
      followingCount,
    };

    res.json({
      success: true,
      user: userProfile
    });
    
  } catch (error) {
    console.error('Get user profile error:', error);
    
    // Handle invalid ObjectId error
    if (error.name === 'CastError') {
      return res.status(400).json({
        error: 'Invalid user ID format',
        message: 'Please provide a valid user ID'
      });
    }
    
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch user profile'
    });
  }
});

export default router;