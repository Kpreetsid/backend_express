import { applicationLogger } from '../observability/logger';
import mongoose from "mongoose";
import { database } from "../configDB";
import { idStandardizationPlugin } from "./mongoosePlugins";

mongoose.plugin(idStandardizationPlugin);

export class MongoConnection {
  private static instance: typeof mongoose | null = null;

  static async connect(): Promise<typeof mongoose> {
    if (this.instance) {
      applicationLogger.info("⚡ MongoDB already connected (pooled)");
      return this.instance;
    }
    try {
      const hasCredentials = !!database.userName && !!database.password;
      const credentials = hasCredentials ? `${encodeURIComponent(database.userName!)}:${encodeURIComponent(database.password!)}@` : "";
      const query = new URLSearchParams({ retryWrites: String(database.retryWrites) });

      if (hasCredentials && database.authSource) {
        query.set("authSource", database.authSource);
      }

      const mongoUri = database.uri || `mongodb://${credentials}${database.host}:${database.port}/${database.databaseName}?${query.toString()}`;
      await mongoose.connect(mongoUri, {
        autoIndex: database.autoIndex,
        connectTimeoutMS: 10000,
        maxPoolSize: database.maxPoolSize,
        minPoolSize: database.minPoolSize,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });
      applicationLogger.info("✅ MongoDB connected (pooled connection)");
      this.instance = mongoose;
      // 🟦 Optional event listeners
      mongoose.connection.on("connected", () => applicationLogger.info("📡 Mongoose connected"));
      mongoose.connection.on("error", (err) => applicationLogger.error("❗ Mongoose error:", err));
      mongoose.connection.on("disconnected", () => applicationLogger.info("🔌 Mongoose disconnected"));
      return mongoose;
    } catch (error) {
      applicationLogger.error({ err: error }, '❌ MongoDB connection error:');
      process.exit(1);
    }
  }

  static async disconnect(): Promise<void> {
    if (this.instance) {
      await mongoose.disconnect();
      this.instance = null;
      applicationLogger.info('✅ MongoDB disconnected');
    }
  }
}
