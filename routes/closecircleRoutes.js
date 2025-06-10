// routes/journalRoutes.js or wherever you define your journal routes
import express from 'express';
import Journal from '../models/journalModel.js';
import User from '../models/userModel.js';
import Reaction from '../models/reactionModel.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();


//public
// GET /api/journals/public - Fetch journals that are visible to everyone
router.get('/public', protect, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const userId = req.user.id;

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Find journals that are visible to everyone
    // Only get journals with visibility 'everyone'
    const journals = await Journal.find({
      visibility: 'everyone'
    })
    .populate({
      path: 'author',
      select: 'name username profileImage bio location'
    })
    .sort({ createdAt: -1 }) // Most recent first
    .skip(skip)
    .limit(parseInt(limit));

    // Get total count for pagination
    const totalJournals = await Journal.countDocuments({
      visibility: 'everyone'
    });

    const totalPages = Math.ceil(totalJournals / parseInt(limit));
    const hasMore = parseInt(page) < totalPages;

    // Get actual like counts for each journal
    const journalIds = journals.map(j => j._id);
    const likeCounts = await Reaction.aggregate([
      { $match: { journal: { $in: journalIds }, type: 'like' } },
      { $group: { _id: '$journal', count: { $sum: 1 } } }
    ]);

    // Create a map for quick lookup
    const likeCountMap = {};
    likeCounts.forEach(item => {
      likeCountMap[item._id.toString()] = item.count;
    });

    // Increment read count for each journal (like LinkedIn impressions)
    const journalIdsToUpdate = journals.map(j => j._id);
    if (journalIdsToUpdate.length > 0) {
      await Journal.updateMany(
        { _id: { $in: journalIdsToUpdate } },
        { $inc: { readsCount: 1 } }
      );
    }

    // Transform the data to match frontend expectations
    const transformedJournals = journals.map(journal => ({
      _id: journal._id,
      title: journal.title,
      content: journal.content,
      images: journal.images || [],
      journaldate: journal.journaldate,
      visibility: journal.visibility,
      isAnonymous: journal.isAnonymous,
      createdAt: journal.createdAt,
      likes: likeCountMap[journal._id.toString()] || 0, // Use actual like count
      reads: (journal.readsCount || 0) + 1, // Add 1 to account for current read
      author: journal.isAnonymous ? null : {
        id: journal.author._id,
        name: journal.author.name,
        username: journal.author.username,
        profileImage: journal.author.profileImage,
        bio: journal.author.bio,
        location: journal.author.location
      }
    }));

    res.status(200).json({
      journals: transformedJournals,
      hasMore,
      currentPage: parseInt(page),
      totalPages,
      total: totalJournals
    });

  } catch (error) {
    console.error('Error fetching public journals:', error);
    res.status(500).json({ 
      message: 'Error fetching public journals',
      error: error.message 
    });
  }
});


// GET /api/journals/close-circle - Fetch journals from user's close circle
router.get('/close-circle', protect, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const userId = req.user.id;

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // First, get the current user to access their close circle
    const currentUser = await User.findById(userId).populate('closecircle', '_id');
    
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get the IDs of users in the close circle
    const closeCircleIds = currentUser.closecircle.map(friend => friend._id);
    
    // If no close circle, return empty array
    if (closeCircleIds.length === 0) {
      return res.status(200).json({
        journals: [],
        hasMore: false,
        currentPage: parseInt(page),
        totalPages: 0
      });
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Find journals from close circle users
    // Only get journals with visibility 'close-circle' or 'everyone'
    const journals = await Journal.find({
      author: { $in: closeCircleIds },
      visibility: { $in: ['close-circle'] }
    })
    .populate({
      path: 'author',
      select: 'name username profileImage bio location'
    })
    .sort({ createdAt: -1 }) // Most recent first
    .skip(skip)
    .limit(parseInt(limit));

    // Get total count for pagination
    const totalJournals = await Journal.countDocuments({
      author: { $in: closeCircleIds },
      visibility: { $in: ['close-circle', 'everyone'] }
    });

    const totalPages = Math.ceil(totalJournals / parseInt(limit));
    const hasMore = parseInt(page) < totalPages;

    // Get actual like counts for each journal
    const journalIds = journals.map(j => j._id);
    const likeCounts = await Reaction.aggregate([
      { $match: { journal: { $in: journalIds }, type: 'like' } },
      { $group: { _id: '$journal', count: { $sum: 1 } } }
    ]);

    // Create a map for quick lookup
    const likeCountMap = {};
    likeCounts.forEach(item => {
      likeCountMap[item._id.toString()] = item.count;
    });

    // Increment read count for each journal (like LinkedIn impressions)
    const journalIdsToUpdate = journals.map(j => j._id);
    if (journalIdsToUpdate.length > 0) {
      await Journal.updateMany(
        { _id: { $in: journalIdsToUpdate } },
        { $inc: { readsCount: 1 } }
      );
    }

    // Transform the data to match frontend expectations
    const transformedJournals = journals.map(journal => ({
      _id: journal._id,
      title: journal.title,
      content: journal.content,
      images: journal.images || [],
      journaldate: journal.journaldate,
      visibility: journal.visibility,
      isAnonymous: journal.isAnonymous,
      createdAt: journal.createdAt,
      likes: likeCountMap[journal._id.toString()] || 0, // Use actual like count
      reads: (journal.readsCount || 0) + 1, // Add 1 to account for current read
      author: journal.isAnonymous ? null : {
        id: journal.author._id,
        name: journal.author.name,
        username: journal.author.username,
        profileImage: journal.author.profileImage,
        bio: journal.author.bio,
        location: journal.author.location
      }
    }));

    res.status(200).json({
      journals: transformedJournals,
      hasMore,
      currentPage: parseInt(page),
      totalPages,
      total: totalJournals
    });

  } catch (error) {
    console.error('Error fetching close circle journals:', error);
    res.status(500).json({ 
      message: 'Error fetching close circle journals',
      error: error.message 
    });
  }
});

// POST /api/journals/:id/like - Like a journal
router.post('/:id/like', protect, async (req, res) => {
  try {
    const journalId = req.params.id;
    const userId = req.user.id;

    // Check if already liked
    const existing = await Reaction.findOne({ user: userId, journal: journalId, type: 'like' });

    if (existing) {
      return res.status(400).json({ message: 'Already liked' });
    }

    // Create the like reaction
    await Reaction.create({ user: userId, journal: journalId, type: 'like' });

    // Count total likes for this journal
    const likeCount = await Reaction.countDocuments({ journal: journalId, type: 'like' });
    
    // Update the journal's like count
    await Journal.findByIdAndUpdate(journalId, { likesCount: likeCount });

    res.status(200).json({ message: 'Liked journal', likesCount: likeCount });

  } catch (error) {
    console.error('Like error:', error);
    res.status(500).json({ message: 'Error liking journal', error: error.message });
  }
});

// GET /api/journals/close-circle - Fetch journals from user's close circle
router.get('/close-circle', protect, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const userId = req.user.id;

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // First, get the current user to access their close circle
    const currentUser = await User.findById(userId).populate('closecircle', '_id');
    
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get the IDs of users in the close circle
    const closeCircleIds = currentUser.closecircle.map(friend => friend._id);
    
    // If no close circle, return empty array
    if (closeCircleIds.length === 0) {
      return res.status(200).json({
        journals: [],
        hasMore: false,
        currentPage: parseInt(page),
        totalPages: 0
      });
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Find journals from close circle users
    // Only get journals with visibility 'close-circle' or 'everyone'
    const journals = await Journal.find({
      author: { $in: closeCircleIds },
      visibility: { $in: ['close-circle', 'everyone'] }
    })
    .populate({
      path: 'author',
      select: 'name username profileImage bio location'
    })
    .sort({ createdAt: -1 }) // Most recent first
    .skip(skip)
    .limit(parseInt(limit));

    // Get total count for pagination
    const totalJournals = await Journal.countDocuments({
      author: { $in: closeCircleIds },
      visibility: { $in: ['close-circle', 'everyone'] }
    });

    const totalPages = Math.ceil(totalJournals / parseInt(limit));
    const hasMore = parseInt(page) < totalPages;

    // Get actual like counts for each journal
    const journalIds = journals.map(j => j._id);
    const likeCounts = await Reaction.aggregate([
      { $match: { journal: { $in: journalIds }, type: 'like' } },
      { $group: { _id: '$journal', count: { $sum: 1 } } }
    ]);

    // Create a map for quick lookup
    const likeCountMap = {};
    likeCounts.forEach(item => {
      likeCountMap[item._id.toString()] = item.count;
    });

    // Increment read count for each journal (like LinkedIn impressions)
    const journalIdsToUpdate = journals.map(j => j._id);
    if (journalIdsToUpdate.length > 0) {
      await Journal.updateMany(
        { _id: { $in: journalIdsToUpdate } },
        { $inc: { readsCount: 1 } }
      );
    }

    // Transform the data to match frontend expectations
    const transformedJournals = journals.map(journal => ({
      _id: journal._id,
      title: journal.title,
      content: journal.content,
      images: journal.images || [],
      journaldate: journal.journaldate,
      visibility: journal.visibility,
      isAnonymous: journal.isAnonymous,
      createdAt: journal.createdAt,
      likes: likeCountMap[journal._id.toString()] || 0, // Use actual like count
      reads: (journal.readsCount || 0) + 1, // Add 1 to account for current read
      author: journal.isAnonymous ? null : {
        id: journal.author._id,
        name: journal.author.name,
        username: journal.author.username,
        profileImage: journal.author.profileImage,
        bio: journal.author.bio,
        location: journal.author.location
      }
    }));

    res.status(200).json({
      journals: transformedJournals,
      hasMore,
      currentPage: parseInt(page),
      totalPages,
      total: totalJournals
    });

  } catch (error) {
    console.error('Error fetching close circle journals:', error);
    res.status(500).json({ 
      message: 'Error fetching close circle journals',
      error: error.message 
    });
  }
});

// POST /api/journals/:id/like - Like a journal
router.post('/:id/like', protect, async (req, res) => {
  try {
    const journalId = req.params.id;
    const userId = req.user.id;

    // Check if already liked
    const existing = await Reaction.findOne({ user: userId, journal: journalId, type: 'like' });

    if (existing) {
      return res.status(400).json({ message: 'Already liked' });
    }

    // Create the like reaction
    await Reaction.create({ user: userId, journal: journalId, type: 'like' });

    // Count total likes for this journal
    const likeCount = await Reaction.countDocuments({ journal: journalId, type: 'like' });
    
    // Update the journal's like count
    await Journal.findByIdAndUpdate(journalId, { likesCount: likeCount });

    res.status(200).json({ message: 'Liked journal', likesCount: likeCount });

  } catch (error) {
    console.error('Like error:', error);
    res.status(500).json({ message: 'Error liking journal', error: error.message });
  }
});

// DELETE /api/journals/:id/like - Unlike a journal
router.delete('/:id/like', protect, async (req, res) => {
  try {
    const journalId = req.params.id;
    const userId = req.user.id;

    // Check if the like exists
    const existing = await Reaction.findOne({ user: userId, journal: journalId, type: 'like' });

    if (!existing) {
      return res.status(400).json({ message: 'Like not found' });
    }

    // Remove the like document
    await Reaction.deleteOne({ _id: existing._id });

    // Count remaining likes for this journal
    const likeCount = await Reaction.countDocuments({ journal: journalId, type: 'like' });
    
    // Update the journal's like count
    await Journal.findByIdAndUpdate(journalId, { likesCount: likeCount });

    res.status(200).json({ message: 'Unliked journal', likesCount: likeCount });

  } catch (error) {
    console.error('Unlike error:', error);
    res.status(500).json({ message: 'Error unliking journal', error: error.message });
  }
});

// GET /api/journals/user/likes - Get user's liked journal IDs
router.get('/user/likes', protect, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all journals that this user has liked
    const likedReactions = await Reaction.find({ 
      user: userId, 
      type: 'like' 
    }).select('journal');
    
    const likedJournalIds = likedReactions.map(reaction => reaction.journal.toString());

    res.status(200).json({
      likedJournals: likedJournalIds
    });

  } catch (error) {
    console.error('Error fetching user likes:', error);
    res.status(500).json({ 
      message: 'Error fetching user likes',
      error: error.message 
    });
  }
});

export default router;