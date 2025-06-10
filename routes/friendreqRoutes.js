// routes/friendRequests.js
import express from 'express';
import FriendRequest from '../models/requestModel.js';
import User from '../models/userModel.js'; // Assuming you have a User model
import { protect } from '../middleware/authMiddleware.js'; // Assuming you have an auth middleware for protecting routes

const router = express.Router();

// Send friend request
router.post('/send', protect, async (req, res) => {
  try {
    const { to } = req.body;
    const from = req.user.id; // From authenticated user

    // Validate input
    if (!to) {
      return res.status(400).json({
        success: false,
        message: 'Target user ID is required'
      });
    }

    // Check if user is trying to send request to themselves
    if (from === to) {
      return res.status(400).json({
        success: false,
        message: 'Cannot send friend request to yourself'
      });
    }

    // Check if target user exists
    const targetUser = await User.findById(to);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if friend request already exists
    const existingRequest = await FriendRequest.findOne({
      $or: [
        { from: from, to: to },
        { from: to, to: from }
      ]
    });

    if (existingRequest) {
      if (existingRequest.status === 'pending') {
        return res.status(400).json({
          success: false,
          message: 'Friend request already exists'
        });
      } else if (existingRequest.status === 'accepted') {
        return res.status(400).json({
          success: false,
          message: 'You are already friends with this user'
        });
      }
    }

    // Create new friend request
    const friendRequest = new FriendRequest({
      from: from,
      to: to,
      status: 'pending'
    });

    await friendRequest.save();

    // Populate the friend request with user details
    const populatedRequest = await FriendRequest.findById(friendRequest._id)
      .populate('from', 'name username profileImage')
      .populate('to', 'name username profileImage');

    res.status(201).json({
      success: true,
      message: 'Friend request sent successfully',
      data: populatedRequest
    });

  } catch (error) {
    console.error('Error sending friend request:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get friend request status between current user and target user
router.get('/status/:targetUserId', protect, async (req, res) => {
  try {
    const { targetUserId } = req.params;
    const currentUserId = req.user.id;

    // Find any friend request between these users
    const friendRequest = await FriendRequest.findOne({
      $or: [
        { from: currentUserId, to: targetUserId },
        { from: targetUserId, to: currentUserId }
      ]
    });

    if (!friendRequest) {
      return res.json({
        success: true,
        status: 'none',
        message: 'No friend request exists'
      });
    }

    // Determine the status from current user's perspective
    let status = friendRequest.status;
    
    // If the request was sent by the current user
    if (friendRequest.from.toString() === currentUserId) {
      // Status remains as is (pending, accepted, rejected)
    } else {
      // If the request was sent to the current user
      if (friendRequest.status === 'pending') {
        status = 'received'; // They received a request
      }
    }

    res.json({
      success: true,
      status: status,
      data: friendRequest
    });

  } catch (error) {
    console.error('Error checking friend request status:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Cancel friend request (only by sender)
router.delete('/cancel/:targetUserId', protect, async (req, res) => {
  try {
    const { targetUserId } = req.params;
    const currentUserId = req.user.id;

    // Find the friend request sent by current user
    const friendRequest = await FriendRequest.findOne({
      from: currentUserId,
      to: targetUserId,
      status: 'pending'
    });

    if (!friendRequest) {
      return res.status(404).json({
        success: false,
        message: 'Friend request not found or already processed'
      });
    }

    // Delete the friend request
    await FriendRequest.findByIdAndDelete(friendRequest._id);

    res.json({
      success: true,
      message: 'Friend request cancelled successfully'
    });

  } catch (error) {
    console.error('Error cancelling friend request:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get all pending friend requests for current user (received)
router.get('/pending', protect, async (req, res) => {
  try {
    const currentUserId = req.user.id;

    const pendingRequests = await FriendRequest.find({
      to: currentUserId,
      status: 'pending'
    })
    .populate('from', 'name username profileImage createdAt')
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: pendingRequests,
      count: pendingRequests.length
    });

  } catch (error) {
    console.error('Error fetching pending requests:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get all sent friend requests by current user
router.get('/sent', protect, async (req, res) => {
  try {
    const currentUserId = req.user.id;

    const sentRequests = await FriendRequest.find({
      from: currentUserId
    })
    .populate('to', 'name username profileImage createdAt')
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: sentRequests,
      count: sentRequests.length
    });

  } catch (error) {
    console.error('Error fetching sent requests:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});


// Accept a friend request
router.post('/accept/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params;
    
    // Find the friend request
    const friendRequest = await FriendRequest.findById(requestId)
      .populate('from', 'name username')
      .populate('to', 'name username');
    
    if (!friendRequest) {
      return res.status(404).json({ message: 'Friend request not found' });
    }
    
    if (friendRequest.status !== 'pending') {
      return res.status(400).json({ message: 'Friend request already processed' });
    }
    
    // Update the friend request status
    friendRequest.status = 'accepted';
    await friendRequest.save();
    
    // Add each user to the other's closecircle
    await User.findByIdAndUpdate(
      friendRequest.from._id,
      { $addToSet: { closecircle: friendRequest.to._id } }
    );
    
    await User.findByIdAndUpdate(
      friendRequest.to._id,
      { $addToSet: { closecircle: friendRequest.from._id } }
    );
    
    res.json({ 
      message: 'Friend request accepted successfully',
      friendRequest
    });
    
  } catch (error) {
    console.error('Error accepting friend request:', error);
    res.status(500).json({ message: 'Error accepting friend request' });
  }
});

// Reject a friend request
router.post('/reject/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params;
    
    // Find the friend request
    const friendRequest = await FriendRequest.findById(requestId);
    
    if (!friendRequest) {
      return res.status(404).json({ message: 'Friend request not found' });
    }
    
    if (friendRequest.status !== 'pending') {
      return res.status(400).json({ message: 'Friend request already processed' });
    }
    
    // Update the friend request status
    friendRequest.status = 'rejected';
    await friendRequest.save();
    
    res.json({ 
      message: 'Friend request rejected successfully',
      friendRequest
    });
    
  } catch (error) {
    console.error('Error rejecting friend request:', error);
    res.status(500).json({ message: 'Error rejecting friend request' });
  }
});


export default router;