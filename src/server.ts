import mongoose from "mongoose";
import { idStandardizationPlugin } from "./core/database/mongoose.plugins";
mongoose.plugin(idStandardizationPlugin);

import app from "./app";
import { server as hostDetails } from './core/config/env.config';
import { connectDB, disconnectDB } from "./core/database";
import { initJobScheduler } from "./core/scheduler";
import { initSocket } from "./core/socket";
import { connectRedis, disconnectRedis } from "./core/cache/redis.client";
import { initChangeStreams } from "./core/cache/change-stream/index";
import { UserLogConsumer } from "./core/messaging";

const server = app.listen(hostDetails.port, async () => {
  await connectDB();
  await connectRedis();
  await initChangeStreams(mongoose.connection); // CDC: auto-invalidates Redis on any MongoDB write
  initSocket(server);
  await initJobScheduler();
  await UserLogConsumer.initialize(); // Start Redis Stream consumer loop for User Logs
  console.log(`Server running on port http://${hostDetails.host}:${hostDetails.port}`);
});

const shutdown = async () => {
  console.log("\nGracefully shutting down...");
  UserLogConsumer.stop();
  await disconnectRedis();
  await disconnectDB();
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
