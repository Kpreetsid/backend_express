import mongoose from 'mongoose';
import { database } from '../configDB';

export class MongoConnection {
  private static instance: typeof mongoose | null = null;

  static async connect(): Promise<typeof mongoose> {
    if (this.instance) {
      console.log('⚡ MongoDB already connected');
      return this.instance;
    }

    try {
      const mongoUri = `mongodb://${database.userName}:${database.password}@${database.host}/${database.databaseName}?authSource=${database.authSource}`;
      await mongoose.connect(mongoUri, {
        autoIndex: true,
        connectTimeoutMS: 10000,
      }).then(() => console.log('✅ MongoDB connected'));
      this.instance = mongoose;
      return mongoose;
    } catch (error) {
      console.error('❌ MongoDB connection error:', error);
      process.exit(1);
    }
  }

  static async disconnect(): Promise<void> {
    if (this.instance) {
      await mongoose.disconnect();
      this.instance = null;
      console.log('✅ MongoDB disconnected');
    }
  }
}