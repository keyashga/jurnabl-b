// routes/journalRoutes.js
import express from 'express';
import {
  createJournal,
  getAllJournals,
  getJournalById,
  updateJournal,
  deleteJournal,
  getJournalsByUser,
  getJournalByDate
} from '../controllers/journalController.js';
import { protect } from '../middleware/authMiddleware.js';
import upload from '../middleware/upload.js';
import Journal from '../models/journalModel.js'; // Import the Journal model

const router = express.Router();

router.post('/', protect, upload.single('image'), createJournal);
router.get('/', protect, getAllJournals);
router.get('/:id', protect, getJournalById);
router.put('/:id', protect, upload.single('image'), updateJournal);
router.delete('/:id', protect, deleteJournal);
router.get('/user/:userId', protect, getJournalsByUser);
router.get('/date/:date', protect, getJournalByDate);

//for pdf download

// Example Express.js route
router.get('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const journals = await Journal.find({ author: userId })
      .populate('author', 'name username')
      .sort({ journaldate: -1, createdAt: -1 });
    
    res.json(journals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Backend API route (Express.js example)
// Add this to your journals router

// GET /api/journals/month/:year/:month
router.get('/month/:year/:month', protect, async (req, res) => {
  try {
    const { year, month } = req.params;
    const userId = req.user.id; // From authentication middleware

    // Validate year and month
    const yearNum = parseInt(year);
    const monthNum = parseInt(month);
    
    if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      return res.status(400).json({ message: 'Invalid year or month' });
    }

    // Since journaldate is stored as string in YYYY-MM-DD format
    // Create regex pattern to match the year-month
    const monthStr = String(monthNum).padStart(2, '0');
    const yearMonthPattern = `${yearNum}-${monthStr}`;
    
    // Find all journals for this user in this month using regex
    const journals = await Journal.find({
      author: userId, // Note: your schema uses 'author', not 'userId'
      journaldate: {
        $regex: `^${yearMonthPattern}-`, // Matches YYYY-MM-DD format
        $options: 'i'
      }
    }).select('journaldate').lean();

    // Return the journals with their dates
    res.json(journals);

  } catch (error) {
    console.error('Error fetching journal dates for month:', error);
    res.status(500).json({ 
      message: 'Failed to fetch journal dates',
      error: error.message 
    });
  }
});

// Alternative: If you want to return just the dates as strings
router.get('/month/:year/:month/dates-only', protect, async (req, res) => {
  try {
    const { year, month } = req.params;
    const userId = req.user.id;

    const yearNum = parseInt(year);
    const monthNum = parseInt(month);
    
    if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      return res.status(400).json({ message: 'Invalid year or month' });
    }

    // Create regex pattern for YYYY-MM format
    const monthStr = String(monthNum).padStart(2, '0');
    const yearMonthPattern = `${yearNum}-${monthStr}`;

    const journals = await Journal.find({
      author: userId, // Note: your schema uses 'author', not 'userId'
      journaldate: {
        $regex: `^${yearMonthPattern}-`,
        $options: 'i'
      }
    }).select('journaldate').lean();

    // Since journaldate is already a string in YYYY-MM-DD format, 
    // we can return it directly
    const dateStrings = journals.map(journal => journal.journaldate);

    res.json({ dates: dateStrings });

  } catch (error) {
    console.error('Error fetching journal dates for month:', error);
    res.status(500).json({ 
      message: 'Failed to fetch journal dates',
      error: error.message 
    });
  }
});

export default router;
