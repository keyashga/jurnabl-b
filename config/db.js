import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config(); // Load environment variables from .env file

const mongoURI = process.env.MONGO_URI;

// Function to connect to MongoDB
const connectToDB = async () => {
  try {
    await mongoose.connect(mongoURI);
    console.log('MongoDB connected successfully!');
  } catch (error) {
    console.error('MongoDB connection error:', error);
  }
};

export default connectToDB;