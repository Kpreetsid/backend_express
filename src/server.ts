import mongoose from "mongoose";
import { idStandardizationPlugin } from "./_db/mongoosePlugins";
mongoose.plugin(idStandardizationPlugin);

import app from "./app";
import { server as hostDetails } from './configDB';
import { connectDB, disconnectDB } from "./_db";
import { initJobScheduler } from "./cron";
import { initSocket } from "./_config/socket";
import { connectRedis, disconnectRedis } from "./_config/redis";

const server = app.listen(hostDetails.port, async () => {
  await connectDB();
  await connectRedis();
  initSocket(server);
  await initJobScheduler();
  console.log(`Server running on port http://${hostDetails.host}:${hostDetails.port}`);
});

const shutdown = async () => {
  console.log("\nGracefully shutting down...");
  await disconnectRedis();
  await disconnectDB();
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
