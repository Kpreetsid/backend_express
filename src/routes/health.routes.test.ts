import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';
import { metricsConfig } from '../configDB';

const dependencies = vi.hoisted(() => ({
  redis: vi.fn(),
  queue: vi.fn(),
  storage: {
    healthCheck: vi.fn()
  }
}));

vi.mock('mongoose', () => ({
  default: {
    connection: {
      readyState: 0,
      db: undefined
    }
  }
}));

vi.mock('../_config/redis', () => ({
  checkRedisReadiness: dependencies.redis
}));

vi.mock('../queue/queue-registry', () => ({
  checkQueueReadiness: dependencies.queue
}));

vi.mock('../_config/storage', () => ({
  storageProvider: dependencies.storage
}));

import {
  healthRouter,
  metricsRouter,
  mongoState,
  withTimeout
} from './health.routes';

const app = express();
app.use('/health', healthRouter);
app.use('/metrics', metricsRouter);

const emptyQueueCounts = {
  waiting: 0,
  active: 0,
  delayed: 0,
  failed: 0
};

const setMongoConnection = (
  readyState: number,
  ping?: () => Promise<unknown>
): void => {
  const connection = mongoose.connection as any;
  connection.readyState = readyState;
  connection.db = ping
    ? { admin: () => ({ ping }) }
    : undefined;
};

beforeEach(() => {
  setMongoConnection(0);
  dependencies.redis.mockReset().mockResolvedValue('disabled');
  dependencies.queue.mockReset().mockResolvedValue({
    status: 'disabled',
    counts: emptyQueueCounts
  });
  dependencies.storage.healthCheck = vi.fn().mockResolvedValue(true);
});

afterEach(() => {
  vi.useRealTimers();
  metricsConfig.token = undefined;
});

describe('operational endpoints', () => {
  it('keeps root, liveness, and startup independent from external dependencies', async () => {
    const [root, live, startup] = await Promise.all([
      request(app).get('/health'),
      request(app).get('/health/live'),
      request(app).get('/health/startup')
    ]);

    expect(root.status).toBe(200);
    expect(root.body).toEqual({
      status: 'ok',
      uptime: expect.any(Number),
      timestamp: expect.any(Number)
    });
    expect(live.status).toBe(200);
    expect(live.body).toEqual({ status: 'ok' });
    expect(startup.status).toBe(200);
    expect(startup.body).toEqual({
      status: 'ok',
      uptime: expect.any(Number),
      timestamp: expect.any(Number)
    });
  });

  it.each([
    [0, 'disconnected'],
    [2, 'connecting'],
    [3, 'disconnecting'],
    [99, 'unknown']
  ])('reports MongoDB readyState %s as %s', async (readyState, state) => {
    setMongoConnection(readyState);

    const response = await request(app).get('/health/ready');

    expect(response.status).toBe(503);
    expect(response.body.status).toBe('degraded');
    expect(response.body.checks).toEqual({
      mongodb: state,
      redis: 'disabled',
      queue: 'disabled',
      storage: 'connected'
    });
  });

  it('returns ready only after every required dependency is usable', async () => {
    const ping = vi.fn().mockResolvedValue({ ok: 1 });
    setMongoConnection(1, ping);
    dependencies.redis.mockResolvedValue('connected');
    dependencies.queue.mockResolvedValue({
      status: 'connected',
      counts: { waiting: 2, active: 1, delayed: 3, failed: 4 }
    });

    const response = await request(app).get('/health/ready');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.checks).toEqual({
      mongodb: 'connected',
      redis: 'connected',
      queue: 'connected',
      storage: 'connected'
    });
    expect(ping).toHaveBeenCalledOnce();
  });

  it('fails readiness when MongoDB reports connected without a pingable database', async () => {
    setMongoConnection(1);

    const response = await request(app).get('/health/ready');

    expect(response.status).toBe(503);
    expect(response.body.checks.mongodb).toBe('unavailable');
  });

  it('fails readiness when the MongoDB ping is rejected', async () => {
    setMongoConnection(1, vi.fn().mockRejectedValue(new Error('primary unavailable')));

    const response = await request(app).get('/health/ready');

    expect(response.status).toBe(503);
    expect(response.body.checks.mongodb).toBe('unavailable');
  });

  it('converts rejected dependency probes into a structured degraded response', async () => {
    setMongoConnection(1, vi.fn().mockResolvedValue({ ok: 1 }));
    dependencies.redis.mockRejectedValue(new Error('Redis unavailable'));
    dependencies.queue.mockRejectedValue(new Error('Queue unavailable'));
    dependencies.storage.healthCheck = vi.fn()
      .mockRejectedValue(new Error('Storage unavailable'));

    const response = await request(app).get('/health/ready');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      status: 'degraded',
      checks: {
        mongodb: 'connected',
        redis: 'disconnected',
        queue: 'unavailable',
        storage: 'unavailable'
      },
      timestamp: expect.any(Number)
    });
  });

  it('allows providers without a health probe while retaining required checks', async () => {
    setMongoConnection(1, vi.fn().mockResolvedValue({ ok: 1 }));
    dependencies.redis.mockResolvedValue('connected');
    dependencies.queue.mockResolvedValue({
      status: 'connected',
      counts: emptyQueueCounts
    });
    dependencies.storage.healthCheck = undefined as any;

    const response = await request(app).get('/health/ready');

    expect(response.status).toBe(200);
    expect(response.body.checks.storage).toBe('connected');
  });

  it('bounds dependency probes and returns the supplied fallback', async () => {
    vi.useFakeTimers();
    const result = withTimeout(
      new Promise<string>(() => undefined),
      25,
      'timed-out'
    );

    await vi.advanceTimersByTimeAsync(25);

    await expect(result).resolves.toBe('timed-out');
  });

  it('maps all documented MongoDB connection states', () => {
    setMongoConnection(0);
    expect(mongoState()).toBe('disconnected');
    setMongoConnection(1);
    expect(mongoState()).toBe('connected');
    setMongoConnection(2);
    expect(mongoState()).toBe('connecting');
    setMongoConnection(3);
    expect(mongoState()).toBe('disconnecting');
    setMongoConnection(100);
    expect(mongoState()).toBe('unknown');
  });

  it('exports Prometheus metrics when optional dependencies are disabled', async () => {
    const response = await request(app).get('/metrics');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.text).toContain('cmms_process_cpu_seconds_total');
    expect(response.text).toContain('cmms_mongodb_ready');
    expect(response.text).toContain('cmms_queue_ready');
    expect(response.text).toContain('cmms_queue_jobs');
  });

  it('keeps metrics available when dependency probes reject', async () => {
    dependencies.redis.mockRejectedValue(new Error('Redis unavailable'));
    dependencies.queue.mockRejectedValue(new Error('Queue unavailable'));

    const response = await request(app).get('/metrics');

    expect(response.status).toBe(200);
    expect(response.text).toContain('cmms_redis_ready 0');
    expect(response.text).toContain('cmms_queue_ready 0');
  });

  it('requires a bearer credential when metrics protection is configured', async () => {
    metricsConfig.token = 'metrics-1234567890123456789012345';

    const rejected = await request(app).get('/metrics');
    const accepted = await request(app)
      .get('/metrics')
      .set('Authorization', `Bearer ${metricsConfig.token}`);

    expect(rejected.status).toBe(401);
    expect(rejected.body).toEqual({
      status: false,
      message: 'Metrics authentication required'
    });
    expect(accepted.status).toBe(200);
    expect(accepted.text).toContain('cmms_process_cpu_seconds_total');
  });
});
