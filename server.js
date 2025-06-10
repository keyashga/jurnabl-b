import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import session from 'express-session';
import passport from 'passport';
import connectToDB from './config/db.js';

// Import Google Auth setup
import './config/passport.js'; // this file sets up passport-google-oauth

// Import routes
import authRoutes from './routes/authRoutes.js';
import journalRoutes from './routes/journalRoutes.js';
import reactionRoutes from './routes/reactionRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import searchRoutes from './routes/searchRoutes.js';
import userRoutes from './routes/userRoutes.js';
import friendreqRoutes from './routes/friendreqRoutes.js';
import myprofileRoutes from './routes/myprofileRoutes.js';
import closecircleRoutes from './routes/closecircleRoutes.js';
import communityRoutes from './routes/communityRoutes.js';

dotenv.config();

// Connect to MongoDB
connectToDB();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.CORS_URL,
  credentials: true,
}));

app.use(express.json());

// Setup session middleware (needed for passport)
app.use(session({
  secret: process.env.SESSION_SECRET || 'supersecret',
  resave: false,
  saveUninitialized: false,
}));

// Initialize Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.get('/', (req, res) => {
  res.send('📓 Journaling API is running...');
});

app.use('/api/auth', authRoutes);
app.use('/api/journals', journalRoutes);
app.use('/api/reactions', reactionRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/users', userRoutes);
app.use('/api/friend-requests', friendreqRoutes);
app.use('/api/journal', closecircleRoutes);
app.use('/api/myprofile', myprofileRoutes);
app.use('/api/myprofile/community', communityRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
