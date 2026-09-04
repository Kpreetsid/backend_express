import mongoose from "mongoose";
import { idStandardizationPlugin } from "./core/database/mongoose.plugins";
mongoose.plugin(idStandardizationPlugin);

import app from "./app";
import { server as hostDetails, validateEnvConfig } from './core/config/env.config';
import { connectDB, disconnectDB } from "./core/database";
import { initJobScheduler, stopJobScheduler } from "./core/scheduler";
import { initSocket, stopSocket } from "./core/socket";
import { connectRedis, disconnectRedis } from "./core/cache/redis.client";
import { initChangeStreams, stopChangeStreams } from "./core/cache/change-stream/index";
import { UserLogConsumer } from "./core/messaging";
import { startRuntime, type RuntimeServices } from './core/bootstrap';


const runtimeServices: RuntimeServices = {
  connectDatabase: async () => { await connectDB(); },
  connectCache: connectRedis,
  initializeChangeStreams: async () => initChangeStreams(mongoose.connection),
  initializeSocket: (server) => { initSocket(server); },
  initializeScheduler: initJobScheduler,
  initializeConsumers: async () => { await UserLogConsumer.initialize(); },
  stopConsumers: async () => { await UserLogConsumer.stop(); },
  stopScheduler: stopJobScheduler,
  stopChangeStreams,
  stopSocket,
  disconnectCache: disconnectRedis,
  disconnectDatabase: disconnectDB,
};

const main = async (): Promise<void> => {
  const validation = validateEnvConfig();
  if (!validation.valid) {
    console.error('Fatal: Environment configuration invalid:');
    for (const err of validation.errors) {
      console.error(` - ${err}`);
    }
    process.exit(1);
  }

  const runtime = await startRuntime(app, hostDetails.port, hostDetails.host, runtimeServices);
  console.log(`Server running on http://${hostDetails.host}:${hostDetails.port}`);

  let terminating = false;
  const terminate = (signal: string) => {
    if (terminating) return;
    terminating = true;
    void runtime.shutdown(signal)
      .then(() => { process.exitCode = 0; })
      .catch((error) => {
        console.error('Graceful shutdown failed:', error);
        process.exitCode = 1;
      });
  };

  process.once('SIGINT', () => terminate('SIGINT'));
  process.once('SIGTERM', () => terminate('SIGTERM'));
};

void main().catch((error) => {
  console.error('Application startup failed:', error);
  process.exitCode = 1;
});
