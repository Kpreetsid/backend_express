import Redis from 'ioredis';
import { redisConfig } from '../config/env.config';

let redisClient: Redis | null = null;

const createRedisClient = (): Redis => {
  const client = new Redis({
    host: redisConfig.host,
    port: redisConfig.port,
    password: redisConfig.password,
    db: redisConfig.db,
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: redisConfig.connectTimeoutMs,
    retryStrategy: (times: number) => Math.min(times * 100, 2000)
  });

  client.on('connect', () => console.log('Redis connecting'));
  client.on('ready', () => console.log('Redis ready'));
  client.on('error', (error: Error) => console.error('Redis error:', error.message));
  client.on('close', () => console.log('Redis connection closed'));

  return client;
};

export const getRedisClient = (): Redis | null => {
  if (!redisConfig.enabled) {
    return null;
  }

  if (!redisClient) {
    redisClient = createRedisClient();
  }

  return redisClient;
};

export const connectRedis = async (): Promise<void> => {
  if (!redisConfig.enabled) {
    console.log('Redis disabled by REDIS_ENABLED=false');
    return;
  }

  const client = getRedisClient();
  if (!client || client.status === 'ready') {
    return;
  }

  try {
    await client.connect();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown Redis connection error';
    console.error('Redis unavailable, continuing without cache:', message);
  }
};

export const disconnectRedis = async (): Promise<void> => {
  if (!redisClient) {
    return;
  }

  try {
    await redisClient.quit();
  } catch (error: unknown) {
    redisClient.disconnect();
  } finally {
    redisClient = null;
  }
};

export const isRedisReady = (): boolean => {
  return !!redisClient && redisClient.status === 'ready';
};
