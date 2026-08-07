import mongoose from "mongoose";
import { idStandardizationPlugin } from "./_db/mongoosePlugins";
mongoose.plugin(idStandardizationPlugin);

import app from "./app";
import { server as hostDetails } from './configDB';
import { connectDB, disconnectDB } from "./_db";
import { initJobScheduler } from "./cron";
import { initSocket } from "./_config/socket";
import { connectRedis, disconnectRedis } from "./_config/redis";
import { initChangeStreams } from "./_cache/changeStream";
import { UserLogConsumer } from "./_cache/streams/userLogConsumer";
// import { analysisFeatureService } from "./masters/analysisFeature/analysisFeature.service";

const server = app.listen(hostDetails.port, async () => {
  await connectDB();
  // const analysisFeatureSync = await analysisFeatureService.syncDefaultFeaturesForAllAccounts();
  await connectRedis();
  await initChangeStreams(mongoose.connection); // CDC: auto-invalidates Redis on any MongoDB write
  initSocket(server);
  await initJobScheduler();
  await UserLogConsumer.initialize(); // Start Redis Stream consumer loop for User Logs
  // console.log(`Analysis feature sync completed for ${analysisFeatureSync.updatedAccounts} accounts (${analysisFeatureSync.insertedAccounts} inserted)`);
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
