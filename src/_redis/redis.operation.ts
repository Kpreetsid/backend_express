import { getRedisClient } from "./redis.instance";

export const redisSet = async (key: string, value: any, ttlSeconds: number = 600): Promise<void> => {
  const redis = getRedisClient();
  console.log('redisSet', key);
  await redis.set(key, JSON.stringify(value), { EX: ttlSeconds });
};

export const redisGet = async <T = any>(key: string): Promise<T | null> => {
  const redis = getRedisClient();
  const data = await redis.get(key);
  console.log('redisGet', key);
  return data ? JSON.parse(data) : null;
};

export const redisDelete = async (key: string): Promise<void> => {
  const redis = getRedisClient();
  console.log('redisDelete', key);
  await redis.del(key);
};

export const redisExists = async (key: string): Promise<boolean> => {
  const redis = getRedisClient();
  const exists = await redis.exists(key);
  console.log('redisExists', key);
  return exists === 1;
};

export const redisDeletePattern = async (pattern: string): Promise<void> => {
  const redis = getRedisClient();
  const keys: string[] = [];

  for await (const key of redis.scanIterator({
    MATCH: pattern,
    COUNT: 100
  })) {
    keys.push(`${key}`);
  }
  console.log('redisDeletePattern', pattern);
  if (keys.length > 0) {
    await redis.del(keys);
  }
};

export const redisIncrement = async (key: string): Promise<number> => {
  const redis = getRedisClient();
  console.log('redisIncrement', key);
  return await redis.incr(key);
};

export const redisDecrement = async (key: string): Promise<number> => {
  const redis = getRedisClient();
  console.log('redisDecrement', key);
  return await redis.decr(key);
};

export const redisFlushAll = async (pattern: string = "*"): Promise<void> => {
  console.log('redisFlushAll', pattern);
  await redisDeletePattern(pattern);
};

export const buildCacheKey = (...parts: (string | number | undefined | null)[]): string => {
  console.log('buildCacheKey', ...parts);
  return parts.filter(Boolean).join(":");
};