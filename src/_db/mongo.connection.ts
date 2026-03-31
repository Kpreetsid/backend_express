import mongoose from "mongoose";
import { database } from "../configDB";

export class MongoConnection {
  private static instance: typeof mongoose | null = null;

  static async connect(): Promise<typeof mongoose> {
    if (this.instance) {
      console.log("⚡ MongoDB already connected (pooled)");
      return this.instance;
    }
    try {
      const mongoUri = `mongodb://${database.userName}:${database.password}@${database.host}/${database.databaseName}?authSource=${database.authSource}`;
      await mongoose.connect(mongoUri, {
        autoIndex: true,
        connectTimeoutMS: 10000,
        maxPoolSize: database.maxPoolSize,
        minPoolSize: database.minPoolSize,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });
      console.log("✅ MongoDB connected (pooled connection)");
      this.instance = mongoose;
      // 🟦 Optional event listeners
      mongoose.connection.on("connected", () => console.log("📡 Mongoose connected"));
      mongoose.connection.on("error", (err) => console.error("❗ Mongoose error:", err));
      mongoose.connection.on("disconnected", () => console.log("🔌 Mongoose disconnected"));
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