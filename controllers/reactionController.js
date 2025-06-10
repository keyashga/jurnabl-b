import Reaction from '../models/reactionModel.js';
import Journal from '../models/journalModel.js';

export const toggleReaction = async (req, res) => {
  try {
    const { journalId } = req.body;
    const userId = req.user._id;

    const existing = await Reaction.findOne({ journal: journalId, user: userId });

    if (existing) {
      await existing.deleteOne();
      return res.status(200).json({ message: 'Like removed' });
    }

    const reaction = new Reaction({
      journal: journalId,
      user: userId,
      type: 'like'
    });
    await reaction.save();

    res.status(201).json({ message: 'Like added', reaction });
  } catch (error) {
    res.status(500).json({ message: 'Failed to toggle like', error });
  }
};

export const getReactionsByJournal = async (req, res) => {
  try {
    const { journalId } = req.params;

    const reactions = await Reaction.find({ journal: journalId }).populate('user', 'name profileImage');

    res.json(reactions);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch likes', error });
  }
};
