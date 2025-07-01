import { EarlyAccessUser } from '../models/EarlyAccessUser.js';

export const registerUser = async (req, res) => {
  try {
    const { fullName, mobileNumber, businessName } = req.body;

    if (!fullName || !mobileNumber) {
      return res.status(400).json({ message: 'Name and mobile number are required.' });
    }

    const newUser = new EarlyAccessUser({ fullName, mobileNumber, businessName });
    await newUser.save();

    return res.status(201).json({ message: 'Successfully registered for early access.' });
  } catch (error) {
    console.error('Early access error:', error.message);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};
