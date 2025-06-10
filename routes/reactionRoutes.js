// routes/reactionRoutes.js
import express from 'express';
import {
  toggleReaction,
  getReactionsByJournal
} from '../controllers/reactionController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', protect, toggleReaction); // unified toggle
router.get('/journal/:journalId', getReactionsByJournal);

export default router;
