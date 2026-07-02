import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { redisConfig } from '../configDB';
import { isRedisReady } from '../_config/redis';

const mongoState = () => {
  switch (mongoose.connection.readyState) {
    case 0: return 'disconnected';
    case 1: return 'connected';
    case 2: return 'connecting';
    case 3: return 'disconnecting';
    default: return 'unknown';
  }
};

export const healthRouter = Router();
export const metricsRouter = Router();

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

healthRouter.get('/ready', (_req: Request, res: Response) => {
  const mongodb = mongoState();
  const redis = redisConfig.enabled ? (isRedisReady() ? 'connected' : 'degraded') : 'disabled';
  const ready = mongodb === 'connected';

  res.status(ready ? 200 : 503).json({
    status: ready ? 'ok' : 'degraded',
    checks: {
      mongodb,
      redis
    },
    timestamp: Date.now()
  });
});

metricsRouter.get('/', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.status(200).send([
    '# HELP cmms_process_uptime_seconds Process uptime in seconds.',
    '# TYPE cmms_process_uptime_seconds gauge',
    `cmms_process_uptime_seconds ${process.uptime()}`,
    '# HELP cmms_mongodb_ready MongoDB readiness, 1 when connected.',
    '# TYPE cmms_mongodb_ready gauge',
    `cmms_mongodb_ready ${mongoose.connection.readyState === 1 ? 1 : 0}`,
    '# HELP cmms_redis_ready Redis readiness, 1 when enabled and connected.',
    '# TYPE cmms_redis_ready gauge',
    `cmms_redis_ready ${redisConfig.enabled && isRedisReady() ? 1 : 0}`
  ].join('\n'));
});
