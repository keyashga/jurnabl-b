// models/Journal.js
import mongoose from 'mongoose';

const journalSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  content: { type: String, required: true }, // Rich text/HTML/Markdown
  images: [{ type: String }],
  visibility: {
    type: String,
    enum: ['private', 'close-circle'],
    default: 'private',
  },
  isAnonymous: { type: Boolean, default: false },
  journaldate: { type: String, required: true },

  // New fields
  likesCount: { type: Number, default: 0 },
  readsCount: { type: Number, default: 0 }

}, {
  timestamps: true,
});

journalSchema.index({ author: 1, journaldate: 1 });

export default mongoose.model('Journal', journalSchema);
