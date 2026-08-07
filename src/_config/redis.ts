import { createClient } from 'redis';
import { redisConfig } from '../configDB';
import { applicationLogger } from '../observability/logger';

type RedisClient = ReturnType<typeof createClient>;

let client: RedisClient | undefined;

export const initializeRedis = async (): Promise<RedisClient | undefined> => {
  if (!redisConfig.enabled) return undefined;
  if (!redisConfig.url) throw new Error('REDIS_URL is required when REDIS_ENABLED is true');
  if (client?.isReady) return client;

  client = createClient({
    url: redisConfig.url,
    socket: { connectTimeout: redisConfig.connectTimeoutMs }
  });
  client.on('error', (error: unknown) => applicationLogger.error({ err: error }, 'Redis client error'));
  await client.connect();
  return client;
};

export const getRedisClient = (): RedisClient | undefined => client;

export const checkRedisReadiness = async (): Promise<'disabled' | 'connected' | 'disconnected'> => {
  if (!redisConfig.enabled) return 'disabled';
  if (!client?.isReady) return 'disconnected';
  try {
    return await client.ping() === 'PONG' ? 'connected' : 'disconnected';
  } catch {
    return 'disconnected';
  }
};

export const disconnectRedis = async (): Promise<void> => {
  if (client?.isOpen) await client.close();
  client = undefined;
};
