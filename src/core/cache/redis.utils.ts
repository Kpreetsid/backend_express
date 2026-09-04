import Redis from 'ioredis';
import { getRedisClient } from './redis.client';

type RedisValue = string | number | boolean | null | Record<string, unknown> | unknown[];

const serialize = (value: unknown): string => {
  return typeof value === 'string' ? value : JSON.stringify(value);
};

const deserialize = <T>(value: string | null): T | null => {
  if (value === null) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return value as T;
  }
};

const deserializeArray = <T>(values: string[]): T[] => values
  .map((value) => deserialize<T>(value))
  .filter((value): value is T => value !== null);

export class RedisUtils {
  private static client(): Redis | null {
    return getRedisClient();
  }

  private static logError(operation: string, error: unknown): void {
    const message = error instanceof Error ? error.message : 'Unknown Redis error';
    console.error(`Redis ${operation} failed:`, message);
  }

  /* -------------------------- STRING -------------------------- */

  static async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const client = this.client();
    if (!client) {
      return;
    }

    try {
      const data = serialize(value);
      if (ttlSeconds && ttlSeconds > 0) {
        await client.set(key, data, 'EX', ttlSeconds);
        return;
      }

      await client.set(key, data);
    } catch (error: unknown) {
      this.logError('set', error);
    }
  }

  static async get<T>(key: string): Promise<T | null> {
    const client = this.client();
    if (!client) {
      return null;
    }

    try {
      return deserialize<T>(await client.get(key));
    } catch (error: unknown) {
      this.logError('get', error);
      return null;
    }
  }

  static async delete(key: string): Promise<void> {
    await this.deleteMany([key]);
  }

  static async deleteMany(keys: string[]): Promise<void> {
    const client = this.client();
    const uniqueKeys = Array.from(new Set(keys.filter(Boolean)));
    if (!client || uniqueKeys.length === 0) {
      return;
    }

    try {
      await client.del(...uniqueKeys);
    } catch (error: unknown) {
      this.logError('delete', error);
    }
  }

  static async exists(key: string): Promise<boolean> {
    const client = this.client();
    if (!client) {
      return false;
    }

    try {
      return (await client.exists(key)) === 1;
    } catch (error: unknown) {
      this.logError('exists', error);
      return false;
    }
  }

  static async expire(key: string, ttlSeconds: number): Promise<void> {
    const client = this.client();
    if (!client) {
      return;
    }

    try {
      await client.expire(key, ttlSeconds);
    } catch (error: unknown) {
      this.logError('expire', error);
    }
  }

  static async ttl(key: string): Promise<number | null> {
    const client = this.client();
    if (!client) {
      return null;
    }

    try {
      return client.ttl(key);
    } catch (error: unknown) {
      this.logError('ttl', error);
      return null;
    }
  }

  /* -------------------------- HASH -------------------------- */

  static async setHash(key: string, data: Record<string, RedisValue>): Promise<void> {
    const client = this.client();
    if (!client) {
      return;
    }

    const formatted = Object.entries(data).reduce<Record<string, string>>((result, [field, value]) => {
      result[field] = serialize(value);
      return result;
    }, {});

    try {
      await client.hset(key, formatted);
    } catch (error: unknown) {
      this.logError('hset', error);
    }
  }

  static async getHash<T extends Record<string, unknown>>(key: string): Promise<T | null> {
    const client = this.client();
    if (!client) {
      return null;
    }

    try {
      const data = await client.hgetall(key);
      if (!Object.keys(data).length) {
        return null;
      }

      return Object.entries(data).reduce<Record<string, unknown>>((result, [field, value]) => {
        result[field] = deserialize(value);
        return result;
      }, {}) as T;
    } catch (error: unknown) {
      this.logError('hgetall', error);
      return null;
    }
  }

  static async getHashField<T>(key: string, field: string): Promise<T | null> {
    const client = this.client();
    if (!client) {
      return null;
    }

    try {
      return deserialize<T>(await client.hget(key, field));
    } catch (error: unknown) {
      this.logError('hget', error);
      return null;
    }
  }

  static async deleteHashField(key: string, field: string): Promise<void> {
    const client = this.client();
    if (!client) {
      return;
    }

    try {
      await client.hdel(key, field);
    } catch (error: unknown) {
      this.logError('hdel', error);
    }
  }

  /* -------------------------- LIST -------------------------- */

  static async pushLeft(key: string, value: unknown): Promise<void> {
    const client = this.client();
    if (!client) {
      return;
    }

    try {
      await client.lpush(key, serialize(value));
    } catch (error: unknown) {
      this.logError('lpush', error);
    }
  }

  static async pushRight(key: string, value: unknown): Promise<void> {
    const client = this.client();
    if (!client) {
      return;
    }

    try {
      await client.rpush(key, serialize(value));
    } catch (error: unknown) {
      this.logError('rpush', error);
    }
  }

  static async popLeft<T>(key: string): Promise<T | null> {
    const client = this.client();
    if (!client) {
      return null;
    }

    try {
      return deserialize<T>(await client.lpop(key));
    } catch (error: unknown) {
      this.logError('lpop', error);
      return null;
    }
  }

  static async popRight<T>(key: string): Promise<T | null> {
    const client = this.client();
    if (!client) {
      return null;
    }

    try {
      return deserialize<T>(await client.rpop(key));
    } catch (error: unknown) {
      this.logError('rpop', error);
      return null;
    }
  }

  static async getList<T>(key: string): Promise<T[]> {
    const client = this.client();
    if (!client) {
      return [];
    }

    try {
      return deserializeArray<T>(await client.lrange(key, 0, -1));
    } catch (error: unknown) {
      this.logError('lrange', error);
      return [];
    }
  }

  /* -------------------------- SET -------------------------- */

  static async addToSet(key: string, value: unknown): Promise<void> {
    const client = this.client();
    if (!client) {
      return;
    }

    try {
      await client.sadd(key, serialize(value));
    } catch (error: unknown) {
      this.logError('sadd', error);
    }
  }

  static async getSet<T>(key: string): Promise<T[]> {
    const client = this.client();
    if (!client) {
      return [];
    }

    try {
      return deserializeArray<T>(await client.smembers(key));
    } catch (error: unknown) {
      this.logError('smembers', error);
      return [];
    }
  }

  static async removeFromSet(key: string, value: unknown): Promise<void> {
    const client = this.client();
    if (!client) {
      return;
    }

    try {
      await client.srem(key, serialize(value));
    } catch (error: unknown) {
      this.logError('srem', error);
    }
  }

  /* -------------------------- SORTED SET -------------------------- */

  static async addSortedSet(key: string, score: number, value: unknown): Promise<void> {
    const client = this.client();
    if (!client) {
      return;
    }

    try {
      await client.zadd(key, score, serialize(value));
    } catch (error: unknown) {
      this.logError('zadd', error);
    }
  }

  static async getSortedSet<T>(key: string): Promise<T[]> {
    const client = this.client();
    if (!client) {
      return [];
    }

    try {
      return deserializeArray<T>(await client.zrange(key, 0, -1));
    } catch (error: unknown) {
      this.logError('zrange', error);
      return [];
    }
  }

  /* -------------------------- COUNTER -------------------------- */

  static async increment(key: string): Promise<number | null> {
    const client = this.client();
    if (!client) {
      return null;
    }

    try {
      return client.incr(key);
    } catch (error: unknown) {
      this.logError('incr', error);
      return null;
    }
  }

  static async decrement(key: string): Promise<number | null> {
    const client = this.client();
    if (!client) {
      return null;
    }

    try {
      return client.decr(key);
    } catch (error: unknown) {
      this.logError('decr', error);
      return null;
    }
  }

  /* -------------------------- PATTERN -------------------------- */

  static async deleteByPattern(pattern: string, batchSize = 100): Promise<void> {
    const client = this.client();
    if (!client) {
      return;
    }

    try {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', batchSize);
        cursor = nextCursor;
        await this.deleteMany(keys);
      } while (cursor !== '0');
    } catch (error: unknown) {
      this.logError('scan delete', error);
    }
  }

  /* -------------------------- FLUSH -------------------------- */

  static async flush(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Redis flush is disabled in production');
    }

    const client = this.client();
    if (!client) {
      return;
    }

    try {
      await client.flushdb();
    } catch (error: unknown) {
      this.logError('flushdb', error);
    }
  }
}
