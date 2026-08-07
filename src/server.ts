import mongoose from "mongoose";
import { shutdownTelemetry } from "./instrumentation";
import { idStandardizationPlugin } from "./_db/mongoosePlugins";
mongoose.plugin(idStandardizationPlugin);

import app from "./app";
import { server as hostDetails } from './configDB';
import { connectDB, disconnectDB } from "./_db";
import { initJobScheduler } from "./cron";
import { closeSocket, initSocket } from "./_config/socket";
import { createServer } from "http";
import { disconnectRedis, initializeRedis } from "./_config/redis";
import { applicationLogger } from "./observability/logger";
import { validateConfiguration } from "./configDB";
import { closeQueues } from "./queue/queue-registry";

export const server = createServer(app);

export const bootstrap = async (): Promise<void> => {
  validateConfiguration();
  await connectDB();
  await initializeRedis();
  await initSocket(server);
  await initJobScheduler();
  server.listen(hostDetails.port, hostDetails.host, () => {
    applicationLogger.info(
      { host: hostDetails.host, port: hostDetails.port },
      'CMMS API started'
    );
  });
};

let shutdownPromise: Promise<void> | undefined;

export const shutdown = (): Promise<void> => {
  if (shutdownPromise) return shutdownPromise;

  shutdownPromise = (async () => {
    applicationLogger.info('Gracefully shutting down');
    const forcedExit = setTimeout(() => {
      applicationLogger.fatal('Graceful shutdown timed out');
      process.exit(1);
    }, 30_000);
    forcedExit.unref();

    try {
      await closeSocket();
      if (server.listening) {
        await new Promise<void>((resolve, reject) =>
          server.close((error) => error ? reject(error) : resolve())
        );
      }
      await closeQueues();
      await disconnectRedis();
      await disconnectDB();
      await shutdownTelemetry();
      applicationLogger.info('Server closed');
    } catch (error) {
      applicationLogger.error({ err: error }, 'Graceful shutdown failed');
      throw error;
    } finally {
      clearTimeout(forcedExit);
    }
  })();

  return shutdownPromise;
};

export const exitAfterShutdown = async (): Promise<void> => {
  try {
    await shutdown();
    process.exit(0);
  } catch {
    process.exit(1);
  }
};

export const registerProcessLifecycle = (): void => {
  process.on("SIGINT", exitAfterShutdown);
  process.on("SIGTERM", exitAfterShutdown);

  bootstrap().catch((error) => {
    applicationLogger.fatal({ err: error }, 'CMMS API startup failed');
    process.exit(1);
  });
};

if (require.main === module) {
  registerProcessLifecycle();
}
