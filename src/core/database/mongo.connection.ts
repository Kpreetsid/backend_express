import mongoose from "mongoose";
import { database } from "../config/env.config";

const buildHostList = (): string => {
  const hosts = database.hosts || database.host;
  return hosts
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean)
    .map((host) => host.includes(':') ? host : `${host}:${database.port}`)
    .join(',');
};

export class MongoConnection {
  private static instance: typeof mongoose | null = null;

  static async connect(): Promise<typeof mongoose> {
    if (this.instance) {
      console.log("⚡ MongoDB already connected (pooled)");
      return this.instance;
    }
    try {
      const hasCredentials = !!database.userName && !!database.password;
      const credentials = hasCredentials
        ? `${encodeURIComponent(database.userName!)}:${encodeURIComponent(database.password!)}@`
        : "";
      const query = new URLSearchParams({ retryWrites: "false" });
      query.set("retryWrites", String(database.retryWrites));
      query.set("directConnection", String(database.directConnection));

      if (hasCredentials && database.authSource) {
        query.set("authSource", database.authSource);
      }
      const mongoUri = `mongodb://${credentials}${buildHostList()}/${database.databaseName}?${query.toString()}`;
      await mongoose.connect(mongoUri, {
        autoIndex: database.autoIndex,
        autoCreate: true,
        connectTimeoutMS: database.connectTimeoutMS,
        maxPoolSize: database.maxPoolSize,
        minPoolSize: database.minPoolSize,
        serverSelectionTimeoutMS: database.serverSelectionTimeoutMS,
        socketTimeoutMS: database.socketTimeoutMS,
        maxIdleTimeMS: database.maxIdleTimeMS,
      });
      console.log("✅ MongoDB connected (pooled connection)");
      this.instance = mongoose;
      // Event listeners
      mongoose.connection.on("connected", () => console.log("📡 Mongoose connected"));
      mongoose.connection.on("error", (err) => console.error("❗ Mongoose error:", err));
      mongoose.connection.on("disconnected", () => console.log("🔌 Mongoose disconnected"));
      return mongoose;
    } catch (error) {
      console.error('❌ MongoDB connection error:', error);
      throw error;
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
