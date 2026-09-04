import type { Express } from 'express';
import { createServer, type Server } from 'node:http';

export interface RuntimeServices {
  connectDatabase(): Promise<void>;
  connectCache(): Promise<void>;
  initializeChangeStreams(): Promise<void>;
  initializeSocket(server: Server): void;
  initializeScheduler(): Promise<void>;
  initializeConsumers(): Promise<void>;
  stopConsumers(): Promise<void>;
  stopScheduler(): void;
  stopChangeStreams(): Promise<void>;
  stopSocket(): Promise<void>;
  disconnectCache(): Promise<void>;
  disconnectDatabase(): Promise<void>;
}

export interface RunningApplication {
  server: Server;
  shutdown(signal?: string): Promise<void>;
}

const listen = (server: Server, port: number, host: string): Promise<void> => new Promise((resolve, reject) => {
  const onError = (error: Error) => {
    server.off('listening', onListening);
    reject(error);
  };
  const onListening = () => {
    server.off('error', onError);
    resolve();
  };
  server.once('error', onError);
  server.once('listening', onListening);
  server.listen(port, host);
});

const closeServer = (server: Server): Promise<void> => {
  if (!server.listening) return Promise.resolve();
  return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
};

export const startRuntime = async (
  app: Express,
  port: number,
  host: string,
  services: RuntimeServices,
  shutdownTimeoutMs = 15_000,
): Promise<RunningApplication> => {
  const server = createServer(app);
  let shutdownPromise: Promise<void> | null = null;

  const shutdown = (signal = 'shutdown'): Promise<void> => {
    if (shutdownPromise) return shutdownPromise;
    shutdownPromise = (async () => {
      console.log(`Gracefully shutting down (${signal})...`);
      const serverClosed = closeServer(server);
      await Promise.allSettled([
        services.stopConsumers(),
        Promise.resolve().then(() => services.stopScheduler()),
        services.stopChangeStreams(),
        services.stopSocket(),
      ]);
      await Promise.allSettled([
        services.disconnectCache(),
        services.disconnectDatabase(),
      ]);

      const closedInTime = await Promise.race([
        serverClosed.then(() => true, () => true),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), shutdownTimeoutMs)),
      ]);
      if (!closedInTime) server.closeAllConnections();
      console.log('Server closed');
    })();
    return shutdownPromise;
  };

  try {
    await services.connectDatabase();
    await services.connectCache();
    await services.initializeChangeStreams();
    services.initializeSocket(server);
    await services.initializeScheduler();
    await services.initializeConsumers();
    await listen(server, port, host);
    return { server, shutdown };
  } catch (error) {
    await shutdown('startup-failure');
    throw error;
  }
};
