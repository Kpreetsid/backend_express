import { Router, Request, Response } from 'express';
import { timingSafeEqual } from 'crypto';
import mongoose from 'mongoose';
import { checkRedisReadiness } from '../_config/redis';
import {
  dependencyProbeDuration,
  metricsRegistry,
  mongodbReadyGauge,
  queueJobsGauge,
  queueReadyGauge,
  redisReadyGauge
} from '../observability/metrics';
import { storageProvider } from '../_config/storage';
import { checkQueueReadiness } from '../queue/queue-registry';
import { metricsConfig } from '../configDB';

export const mongoState = () => {
  switch (mongoose.connection.readyState) {
    case 0: return 'disconnected';
    case 1: return 'connected';
    case 2: return 'connecting';
    case 3: return 'disconnecting';
    default: return 'unknown';
  }
};

export const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T
): Promise<T> => {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), timeoutMs);
        timer.unref();
      })
    ]);
  } catch {
    return fallback;
  } finally {
    if (timer) clearTimeout(timer);
  }
};

export const healthRouter = Router();
export const metricsRouter = Router();

const metricsAuthorized = (req: Request): boolean => {
  if (!metricsConfig.token) return true;
  const supplied = req.headers.authorization?.replace(/^Bearer\s+/i, '') || '';
  const expectedBuffer = Buffer.from(metricsConfig.token);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length
    && timingSafeEqual(expectedBuffer, suppliedBuffer);
};

metricsRouter.use((req: Request, res: Response, next) => {
  if (!metricsAuthorized(req)) {
    res.status(401).json({ status: false, message: 'Metrics authentication required' });
    return;
  }
  next();
});

healthRouter.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now()
  });
});

healthRouter.get('/live', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

healthRouter.get('/startup', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now()
  });
});

healthRouter.get('/ready', async (_req: Request, res: Response) => {
  let mongodb = mongoState();
  if (mongodb === 'connected') {
    const mongoProbeStarted = process.hrtime.bigint();
    const ping = mongoose.connection.db
      ? mongoose.connection.db.admin().ping()
        .then(() => 'connected' as const)
        .catch(() => 'unavailable' as const)
      : Promise.resolve('unavailable' as const);
    mongodb = await withTimeout(
      ping,
      2000,
      'unavailable'
    );
    dependencyProbeDuration.observe(
      { dependency: 'mongodb', result: mongodb === 'connected' ? 'success' : 'failure' },
      Number(process.hrtime.bigint() - mongoProbeStarted) / 1e9
    );
  }
  const redisProbeStarted = process.hrtime.bigint();
  const redis = await withTimeout(checkRedisReadiness(), 2000, 'disconnected');
  dependencyProbeDuration.observe(
    { dependency: 'redis', result: redis === 'disconnected' ? 'failure' : 'success' },
    Number(process.hrtime.bigint() - redisProbeStarted) / 1e9
  );
  const queueProbeStarted = process.hrtime.bigint();
  const queue = await withTimeout(
    checkQueueReadiness(),
    2000,
    {
      status: 'unavailable' as const,
      counts: { waiting: 0, active: 0, delayed: 0, failed: 0 }
    }
  );
  dependencyProbeDuration.observe(
    { dependency: 'queue', result: queue.status === 'unavailable' ? 'failure' : 'success' },
    Number(process.hrtime.bigint() - queueProbeStarted) / 1e9
  );
  const storageProbeStarted = process.hrtime.bigint();
  const storage = storageProvider.healthCheck
    ? await withTimeout(storageProvider.healthCheck(), 2000, false)
    : true;
  dependencyProbeDuration.observe(
    { dependency: 'storage', result: storage ? 'success' : 'failure' },
    Number(process.hrtime.bigint() - storageProbeStarted) / 1e9
  );
  const ready =
    mongodb === 'connected' &&
    redis !== 'disconnected' &&
    queue.status !== 'unavailable' &&
    storage;
  mongodbReadyGauge.set(mongodb === 'connected' ? 1 : 0);
  redisReadyGauge.set(redis === 'disconnected' ? 0 : 1);
  queueReadyGauge.set(queue.status === 'unavailable' ? 0 : 1);
  Object.entries(queue.counts).forEach(([state, count]) => {
    queueJobsGauge.set({ state }, count);
  });

  res.status(ready ? 200 : 503).json({
    status: ready ? 'ok' : 'degraded',
    checks: {
      mongodb,
      redis,
      queue: queue.status,
      storage: storage ? 'connected' : 'unavailable'
    },
    timestamp: Date.now()
  });
});

metricsRouter.get('/', async (_req: Request, res: Response) => {
  mongodbReadyGauge.set(mongoose.connection.readyState === 1 ? 1 : 0);
  const redis = await withTimeout(checkRedisReadiness(), 2000, 'disconnected');
  redisReadyGauge.set(redis === 'disconnected' ? 0 : 1);
  const queue = await withTimeout(
    checkQueueReadiness(),
    2000,
    {
      status: 'unavailable' as const,
      counts: { waiting: 0, active: 0, delayed: 0, failed: 0 }
    }
  );
  queueReadyGauge.set(queue.status === 'unavailable' ? 0 : 1);
  Object.entries(queue.counts).forEach(([state, count]) => {
    queueJobsGauge.set({ state }, count);
  });
  res.setHeader('Content-Type', metricsRegistry.contentType);
  res.status(200).send(await metricsRegistry.metrics());
});
