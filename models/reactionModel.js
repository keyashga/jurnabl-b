import mongoose from 'mongoose';

const reactionSchema = new mongoose.Schema({
  journal: { type: mongoose.Schema.Types.ObjectId, ref: 'Journal', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['like'], default:'like', required: true }, // Only 'like' allowed
  createdAt: { type: Date, default: Date.now },
});

// Add this to your Reaction model
reactionSchema.index({ user: 1, journal: 1, type: 1 }, { unique: true });

export default mongoose.model('Reaction', reactionSchema);

