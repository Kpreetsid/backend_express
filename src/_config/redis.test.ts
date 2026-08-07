import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient } from 'redis';
import { redisConfig } from '../configDB';
import { applicationLogger } from '../observability/logger';
import {
  checkRedisReadiness,
  disconnectRedis,
  getRedisClient,
  initializeRedis
} from './redis';

vi.mock('redis', () => ({ createClient: vi.fn() }));
vi.mock('../observability/logger', () => ({
  applicationLogger: { error: vi.fn() }
}));

const makeClient = () => ({
  isReady: false,
  isOpen: true,
  on: vi.fn(),
  connect: vi.fn().mockResolvedValue(undefined),
  ping: vi.fn().mockResolvedValue('PONG'),
  close: vi.fn().mockResolvedValue(undefined)
});

describe('Redis lifecycle', () => {
  beforeEach(async () => {
    await disconnectRedis();
    vi.clearAllMocks();
    Object.assign(redisConfig, {
      enabled: true,
      url: 'rediss://cache-user:cache-pass@cache.example.test:6380',
      connectTimeoutMs: 4321
    });
  });

  it('does not create a client when Redis is disabled', async () => {
    redisConfig.enabled = false;
    await expect(initializeRedis()).resolves.toBeUndefined();
    expect(createClient).not.toHaveBeenCalled();
    await expect(checkRedisReadiness()).resolves.toBe('disabled');
  });

  it('requires the centralized URL when Redis is enabled', async () => {
    redisConfig.url = undefined;
    await expect(initializeRedis()).rejects.toThrow('REDIS_URL is required');
  });

  it('connects once, reports readiness, logs client errors, and closes cleanly', async () => {
    const client = makeClient();
    vi.mocked(createClient).mockReturnValue(client as never);

    await expect(initializeRedis()).resolves.toBe(client);
    expect(createClient).toHaveBeenCalledWith({
      url: redisConfig.url,
      socket: { connectTimeout: 4321 }
    });
    expect(client.connect).toHaveBeenCalledOnce();
    expect(getRedisClient()).toBe(client);

    const errorHandler = client.on.mock.calls.find(([event]) => event === 'error')?.[1];
    const error = new Error('redis socket failed');
    errorHandler(error);
    expect(applicationLogger.error).toHaveBeenCalledWith(
      { err: error },
      'Redis client error'
    );

    client.isReady = true;
    await expect(initializeRedis()).resolves.toBe(client);
    expect(client.connect).toHaveBeenCalledOnce();
    await expect(checkRedisReadiness()).resolves.toBe('connected');

    client.ping.mockResolvedValueOnce('NOT_PONG');
    await expect(checkRedisReadiness()).resolves.toBe('disconnected');
    client.ping.mockRejectedValueOnce(new Error('timeout'));
    await expect(checkRedisReadiness()).resolves.toBe('disconnected');

    await disconnectRedis();
    expect(client.close).toHaveBeenCalledOnce();
    expect(getRedisClient()).toBeUndefined();
  });

  it('reports a client that has not reached the ready state as disconnected', async () => {
    const client = makeClient();
    vi.mocked(createClient).mockReturnValue(client as never);
    await initializeRedis();
    await expect(checkRedisReadiness()).resolves.toBe('disconnected');
  });
});
