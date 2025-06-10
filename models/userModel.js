// models/userModel.js
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String },
  
  // Profile fields
  profileImage: { type: String }, // Keep this for backward compatibility
  bio: { type: String, maxLength: 500 }, // Add bio field
  location: { type: String }, // Add location field
  
  // Social connections
  closecircle: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // users this user follows
  
  // Stats
  totalLikes: { type: Number, default: 0 },
  totalReads: { type: Number, default: 0 },
  consistency: { type: Number, default: 0 }, // writing % over time

  resetPasswordToken: String,
  resetPasswordExpires: Date,
}, {
  timestamps: true, // Automatically manage createdAt and updatedAt
});

export default mongoose.model('User', userSchema);

