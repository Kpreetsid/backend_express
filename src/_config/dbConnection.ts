import mongoose from 'mongoose';

export const connectDB = async () => {
  try {
    const mongoURI = "mongodb://52.66.196.15:27017/test";
    await mongoose.connect(mongoURI);
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
};

export const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    console.log('MongoDB disconnected');
  } catch (err) {
    console.error('Error disconnecting MongoDB:', err);
  }
};
