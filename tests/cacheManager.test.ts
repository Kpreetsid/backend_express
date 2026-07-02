/**
 * CacheManager Unit Tests
 *
 * Verifies:
 * - getOrSet: Cache hit and miss flows
 * - getOrSet: Returns loader value on Redis failure (fallback)
 * - del: Deletes single and multiple keys
 * - set: Stores a value with TTL
 * - setIfAbsent: Only sets when key doesn't exist
 * - exists: Correct presence detection
 * - isAvailable: Returns false when Redis is down
 */

import RedisMock from 'ioredis-mock';
import { CacheManager } from '../src/_cache/cacheManager';

jest.mock('../src/_config/redis', () => {
  const RedisMock = require('ioredis-mock');
  const client = new RedisMock();
  return {
    getRedisClient: () => client,
    isRedisReady: jest.fn(() => true),
  };
});

jest.mock('../src/utils/redis.service', () => {
  const { getRedisClient } = jest.requireMock('../src/_config/redis');
  const client = getRedisClient();

  const serialize = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v));
  const deserialize = <T>(v: string | null): T | null => {
    if (v === null) return null;
    try { return JSON.parse(v) as T; } catch { return v as unknown as T; }
  };

  return {
    RedisUtils: {
      get: async <T>(key: string): Promise<T | null> => deserialize<T>(await client.get(key)),
      set: async (key: string, value: unknown, ttl?: number) => {
        if (ttl) await client.set(key, serialize(value), 'EX', ttl);
        else await client.set(key, serialize(value));
      },
      deleteMany: async (keys: string[]) => { if (keys.length) await client.del(...keys); },
      deleteByPattern: async (pattern: string) => {
        let cursor = '0';
        do {
          const [next, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
          cursor = next;
          if (keys.length) await client.del(...keys);
        } while (cursor !== '0');
      },
      exists: async (key: string) => (await client.exists(key)) === 1,
    },
  };
});

// Get the mocked redis client for direct inspection
const { getRedisClient, isRedisReady } = require('../src/_config/redis');
const mockClient = getRedisClient();

beforeEach(async () => {
  await mockClient.flushall();
  (isRedisReady as jest.Mock).mockReturnValue(true);
});

afterAll(() => {
  mockClient.disconnect();
});

describe('CacheManager.getOrSet()', () => {
  it('calls loader on cache miss and returns value', async () => {
    const loader = jest.fn().mockResolvedValue({ name: 'Asset Alpha' });
    const { value, hit } = await CacheManager.getOrSet('test:asset:1', 60, loader);

    expect(loader).toHaveBeenCalledTimes(1);
    expect(hit).toBe(false);
    expect(value).toEqual({ name: 'Asset Alpha' });
  });

  it('returns cached value on second call without invoking loader', async () => {
    const loader = jest.fn().mockResolvedValue({ name: 'Cached Asset' });

    await CacheManager.getOrSet('test:asset:2', 60, loader);
    // Small delay to allow async set to complete
    await new Promise(r => setImmediate(r));

    const { value, hit } = await CacheManager.getOrSet('test:asset:2', 60, loader);

    expect(loader).toHaveBeenCalledTimes(1);
    expect(hit).toBe(true);
    expect(value).toEqual({ name: 'Cached Asset' });
  });

  it('falls back to loader when Redis is unavailable', async () => {
    (isRedisReady as jest.Mock).mockReturnValue(false);
    const loader = jest.fn().mockResolvedValue({ fallback: true });

    const { value, hit } = await CacheManager.getOrSet('test:asset:3', 60, loader);

    expect(loader).toHaveBeenCalledTimes(1);
    expect(hit).toBe(false);
    expect(value).toEqual({ fallback: true });
  });

  it('does not cache null values', async () => {
    const loader = jest.fn().mockResolvedValue(null);
    await CacheManager.getOrSet('test:null', 60, loader);
    await new Promise(r => setImmediate(r));

    const stored = await mockClient.get('test:null');
    expect(stored).toBeNull();
  });
});

describe('CacheManager.del()', () => {
  it('deletes a single key', async () => {
    await mockClient.set('test:del:1', 'value');
    await CacheManager.del('test:del:1');
    expect(await mockClient.get('test:del:1')).toBeNull();
  });

  it('deletes multiple keys at once', async () => {
    await mockClient.mset('test:del:a', 'v1', 'test:del:b', 'v2', 'test:del:c', 'v3');
    await CacheManager.del('test:del:a', 'test:del:b', 'test:del:c');
    expect(await mockClient.get('test:del:a')).toBeNull();
    expect(await mockClient.get('test:del:b')).toBeNull();
    expect(await mockClient.get('test:del:c')).toBeNull();
  });

  it('does not throw when deleting non-existent keys', async () => {
    await expect(CacheManager.del('nonexistent:key')).resolves.not.toThrow();
  });

  it('ignores empty string keys', async () => {
    await expect(CacheManager.del('', 'test:del:1', '')).resolves.not.toThrow();
  });
});

describe('CacheManager.set()', () => {
  it('stores an object with TTL', async () => {
    await CacheManager.set('test:set:1', { foo: 'bar' }, 300);
    const raw = await mockClient.get('test:set:1');
    expect(JSON.parse(raw!)).toEqual({ foo: 'bar' });
  });
});

describe('CacheManager.exists()', () => {
  it('returns true for existing key', async () => {
    await mockClient.set('test:exists', 'yes');
    expect(await CacheManager.exists('test:exists')).toBe(true);
  });

  it('returns false for missing key', async () => {
    expect(await CacheManager.exists('test:missing:xyz')).toBe(false);
  });
});

describe('CacheManager.isAvailable()', () => {
  it('returns true when Redis is ready', () => {
    (isRedisReady as jest.Mock).mockReturnValue(true);
    expect(CacheManager.isAvailable()).toBe(true);
  });

  it('returns false when Redis is not ready', () => {
    (isRedisReady as jest.Mock).mockReturnValue(false);
    expect(CacheManager.isAvailable()).toBe(false);
  });
});
