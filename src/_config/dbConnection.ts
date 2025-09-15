import mongoose from 'mongoose';
import { database } from '../configDB';

export const connectDB = async () => {
  try {
    // const ConnectionStringMongoDB = `mongodb://${database.host}/${database.databaseName}`;
    const ConnectionStringMongoDB = `mongodb://${database.userName}:${database.password}@${database.host}/${database.databaseName}?authSource=${database.authSource}`;
    await mongoose.connect(ConnectionStringMongoDB);
    console.log('MongoDB connected');
 } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

export const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    console.log('MongoDB disconnected');
 } catch (error) {
    console.error('Error disconnecting MongoDB:', error);
  }
};