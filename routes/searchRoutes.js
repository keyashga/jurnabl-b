// routes/communityRoutes.js
import express from 'express';
import User from '../models/userModel.js';
import { protect } from '../middleware/authMiddleware.js';

const authMiddleware=protect;
const router = express.Router();

// Get community stats (counts)
router.get('/count', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = await User.findById(userId).select('closecircle');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const stats = {
      closeFriends: user.closecircle?.length || 0
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching community stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get close friends list with details
router.get('/closefriends', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = await User.findById(userId)
      .populate({
        path: 'closecircle',
        select: 'name username profileImage bio location createdAt',
        options: { sort: { createdAt: -1 } }
      });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const closeFriends = user.closecircle.map(friend => ({
      id: friend._id,
      name: friend.name,
      username: friend.username,
      profileImage: friend.profileImage || null,
      bio: friend.bio || null,
      location: friend.location || null,
      memberSince: friend.createdAt
    }));

    res.json({ closeFriends });
  } catch (error) {
    console.error('Error fetching close friends:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get suggested users (NEW ENDPOINT)
router.get('/suggested', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 8 } = req.query;

    // Get current user to exclude their close friends and themselves
    const currentUser = await User.findById(userId).select('closecircle');
    
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Create exclusion list (current user + close friends)
    const excludeIds = [userId, ...currentUser.closecircle];

    // Get random users using MongoDB aggregation
    const suggestedUsers = await User.aggregate([
      // Exclude current user and their close friends
      { $match: { _id: { $nin: excludeIds } } },
      
      // Randomly sample users
      { $sample: { size: parseInt(limit) } },
      
      // Project only needed fields
      { 
        $project: {
          name: 1,
          username: 1,
          profileImage: 1,
          bio: 1,
          location: 1,
          createdAt: 1,
          // You can add these fields if they exist in your user model
          journalCount: { $ifNull: ['$journalCount', 0] },
          totalLikes: { $ifNull: ['$totalLikes', 0] },
          totalReads: { $ifNull: ['$totalReads', 0] },
          consistency: { $ifNull: ['$consistency', 0] }
        }
      }
    ]);

    const formattedUsers = suggestedUsers.map(user => ({
      id: user._id,
      name: user.name,
      username: user.username,
      profileImage: user.profileImage || null,
      bio: user.bio || null,
      location: user.location || null,
      memberSince: user.createdAt,
      journalCount: user.journalCount || 0,
      totalLikes: user.totalLikes || 0,
      totalReads: user.totalReads || 0,
      consistency: user.consistency || 0
    }));

    res.json({ 
      success: true,
      users: formattedUsers,
      count: formattedUsers.length
    });
  } catch (error) {
    console.error('Error fetching suggested users:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove from close friends
router.delete('/closefriends/:friendId', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const friendId = req.params.friendId;

    // Check if this friend is also a follower
    const user = await User.findById(userId).select('readers closecircle');

    let updateOperation;
    let message;

    
      // If they're only in close friends, just remove from close friends
      updateOperation = { $pull: { closecircle: friendId } };
      message = 'Removed from close friends successfully';

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateOperation,
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ 
      message,
      newCloseFriendsCount: updatedUser.closecircle.length
    });
  } catch (error) {
    console.error('Error removing from close friends:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add to close friends
router.post('/closefriends/:userId', authMiddleware, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const friendId = req.params.userId;

    if (currentUserId === friendId) {
      return res.status(400).json({ message: 'You cannot add yourself to close friends' });
    }

    // Check if already in close friends
    const currentUser = await User.findById(currentUserId);
    if (currentUser.closecircle.includes(friendId)) {
      return res.status(400).json({ message: 'User is already in your close friends' });
    }

    await User.findByIdAndUpdate(
      currentUserId,
      { $addToSet: { closecircle: friendId } }
    );

    res.json({ message: 'Added to close friends successfully' });
  } catch (error) {
    console.error('Error adding to close friends:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Search users (for finding people to follow)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;
    const currentUserId = req.user.id;

    if (!q) {
      return res.status(400).json({ message: 'Search query must be at least 2 characters' });
    }

    const users = await User.find({
      _id: { $ne: currentUserId },
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { username: { $regex: q, $options: 'i' } }
      ]
    })
    .select('name username profileImage bio location createdAt')
    .limit(parseInt(limit))
    .sort({ createdAt: -1 });

    const searchResults = users.map(user => ({
      id: user._id,
      name: user.name,
      username: user.username,
      profileImage: user.profileImage || null,
      bio: user.bio || null,
      location: user.location || null,
      memberSince: user.createdAt
    }));

    res.json({ users: searchResults });
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;