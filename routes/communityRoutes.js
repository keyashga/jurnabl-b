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
router.get('/search', authMiddleware, async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;
    const currentUserId = req.user.id;

    if (!q || q.trim().length < 2) {
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