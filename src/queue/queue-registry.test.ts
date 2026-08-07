import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Queue } from 'bullmq';
import { queueConfig, redisConfig } from '../configDB';
import {
  checkQueueReadiness,
  closeQueues,
  enqueueEvent,
  getQueue,
  getQueueConnectionOptions
} from './queue-registry';

const queueMocks = vi.hoisted(() => ({
  add: vi.fn(),
  close: vi.fn(),
  getJobCounts: vi.fn()
}));

vi.mock('bullmq', () => ({
  Queue: vi.fn(function QueueMock(this: any, name: string, options: unknown) {
    this.name = name;
    this.options = options;
    this.add = queueMocks.add;
    this.close = queueMocks.close;
    this.getJobCounts = queueMocks.getJobCounts;
  })
}));

describe('BullMQ registry', () => {
  beforeEach(async () => {
    await closeQueues();
    vi.clearAllMocks();
    Object.assign(redisConfig, {
      url: 'rediss://queue-user:queue-pass@redis.example.test:6380',
      connectTimeoutMs: 4567
    });
    queueConfig.enabled = true;
    queueMocks.add.mockResolvedValue(undefined);
    queueMocks.close.mockResolvedValue(undefined);
  });

  it('derives bounded connection options from the centralized Redis URL', () => {
    expect(getQueueConnectionOptions()).toEqual({
      host: 'redis.example.test',
      port: 6380,
      username: 'queue-user',
      password: 'queue-pass',
      tls: {},
      connectTimeout: 4567,
      maxRetriesPerRequest: null
    });

    redisConfig.url = 'redis://redis.example.test';
    expect(getQueueConnectionOptions()).toMatchObject({
      port: 6379,
      username: undefined,
      password: undefined,
      tls: undefined
    });
  });

  it('rejects missing Redis configuration and disabled queues', () => {
    redisConfig.url = undefined;
    expect(() => getQueueConnectionOptions()).toThrow('REDIS_URL is required');

    redisConfig.url = 'redis://localhost:6379';
    queueConfig.enabled = false;
    expect(() => getQueue('domain-events')).toThrow('Queues are disabled');
  });

  it('caches queue instances and enqueues versioned events with durable defaults', async () => {
    const first = getQueue('domain-events');
    const second = getQueue('domain-events');
    expect(first).toBe(second);
    expect(Queue).toHaveBeenCalledOnce();

    const envelope = {
      eventId: 'event-1',
      type: 'notification.create',
      version: 1,
      tenantId: 'tenant-1',
      actorId: 'user-1',
      correlationId: 'correlation-1',
      entity: { type: 'notification', id: 'notification-1' },
      timestamp: new Date().toISOString(),
      payload: { message: 'test' }
    };
    await enqueueEvent('domain-events', envelope, { attempts: 2 });

    expect(queueMocks.add).toHaveBeenCalledWith(
      'notification.create',
      envelope,
      expect.objectContaining({
        jobId: 'event-1',
        attempts: 2,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: { age: 86400, count: 10_000 },
        removeOnFail: false
      })
    );
  });

  it('reports disabled, connected, and unavailable queue readiness', async () => {
    queueConfig.enabled = false;
    await expect(checkQueueReadiness()).resolves.toEqual({
      status: 'disabled',
      counts: { waiting: 0, active: 0, delayed: 0, failed: 0 }
    });

    queueConfig.enabled = true;
    queueMocks.getJobCounts.mockResolvedValueOnce({ waiting: 2, active: 1 });
    await expect(checkQueueReadiness()).resolves.toEqual({
      status: 'connected',
      counts: { waiting: 2, active: 1, delayed: 0, failed: 0 }
    });

    queueMocks.getJobCounts.mockRejectedValueOnce(new Error('redis unavailable'));
    await expect(checkQueueReadiness()).resolves.toEqual({
      status: 'unavailable',
      counts: { waiting: 0, active: 0, delayed: 0, failed: 0 }
    });
  });

  it('closes every registered queue and clears the registry', async () => {
    const original = getQueue('domain-events');
    getQueue('email-events');
    await closeQueues();
    expect(queueMocks.close).toHaveBeenCalledTimes(2);
    expect(getQueue('domain-events')).not.toBe(original);
  });
});
