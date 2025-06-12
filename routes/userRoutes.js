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

        // Find user by ID and include relevant public information
        const user = await User.findById(userId)
            .select('-password -email -__v') // Exclude sensitive fields
            .lean(); // .lean() makes the result a plain JavaScript object

        if (!user) {
            return res.status(404).json({
                error: 'User not found',
                message: 'The requested user profile does not exist'
            });
        }

        // --- Calculate additional stats ---

        // 1. Journal Count (Public and Close-Circle journals)
        const journalCount = await Journal.countDocuments({
            author: userId,
            // You had 'visibility: { $ne: 'private' }' commented out here.
            // If you want to count only public/close-circle journals, uncomment it.
            // For now, I'll assume you want all journals by the user.
            // visibility: { $ne: 'private' }
        });

        // 2. totalLikes and totalReads - calculated dynamically from journals
        const journals = await Journal.find({ author: userId });

        // Sum up likesCount and readsCount from all journals
        const totalLikes = journals.reduce((sum, journal) => sum + (journal.likesCount || 0), 0);
        const totalReads = journals.reduce((sum, journal) => sum + (journal.readsCount || 0), 0);

        // 3. Consistency
        // Assuming consistency is a direct field on the User model
        const consistency = user.consistency || 100; // Default to 100 if not set, as per your code

        // 4. Account Created At Date
        const accountCreatedAt = user.createdAt; // This field is automatically added by timestamps: true

        // Transform user object to match frontend expectations
        const userProfile = {
            ...user, // Spread existing user data
            fullName: user.name, // Map name to fullName for frontend
            avatar: user.profileImage, // Map profileImage to avatar for frontend
            profilePicture: user.profileImage, // Also provide profilePicture as backup
            journalCount,
            totalLikes, // Include totalLikes
            totalReads, // Include totalReads
            consistency, // Include consistency
            accountCreatedAt, // Add the account creation date here
        };

        res.json({
            success: true,
            user: userProfile
        });

    } catch (error) {
        console.error('Get user profile error:', error);

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