import RedisMock from 'ioredis-mock';
import { getRedisClient } from '../src/_config/redis';
import { RedisUtils } from '../src/utils/redis.service';

jest.mock('../src/_config/redis', () => ({
  getRedisClient: jest.fn()
}));

const redis = new RedisMock();

describe('RedisUtils', () => {
  beforeEach(async () => {
    await redis.flushall();
    (getRedisClient as jest.Mock).mockReturnValue(redis);
  });

  afterAll(() => {
    redis.disconnect();
  });

  it('stores and reads JSON values with TTL', async () => {
    await RedisUtils.set('cmms:test:string', { ok: true }, 60);

    await expect(RedisUtils.get<{ ok: boolean }>('cmms:test:string')).resolves.toEqual({ ok: true });
    await expect(RedisUtils.ttl('cmms:test:string')).resolves.toBeGreaterThan(0);
  });

  it('handles hashes, lists, sets, sorted sets, and counters with ioredis commands', async () => {
    await RedisUtils.setHash('cmms:test:hash', { status: 'enabled', count: 2 });
    await expect(RedisUtils.getHash('cmms:test:hash')).resolves.toEqual({ status: 'enabled', count: 2 });
    await expect(RedisUtils.getHashField<number>('cmms:test:hash', 'count')).resolves.toBe(2);

    await RedisUtils.pushRight('cmms:test:list', { id: 1 });
    await RedisUtils.pushRight('cmms:test:list', { id: 2 });
    await expect(RedisUtils.getList('cmms:test:list')).resolves.toEqual([{ id: 1 }, { id: 2 }]);

    await RedisUtils.addToSet('cmms:test:set', 'cache-key-1');
    await RedisUtils.addToSet('cmms:test:set', 'cache-key-2');
    await expect(RedisUtils.getSet<string>('cmms:test:set')).resolves.toEqual(expect.arrayContaining(['cache-key-1', 'cache-key-2']));

    await RedisUtils.addSortedSet('cmms:test:zset', 2, { id: 2 });
    await RedisUtils.addSortedSet('cmms:test:zset', 1, { id: 1 });
    await expect(RedisUtils.getSortedSet('cmms:test:zset')).resolves.toEqual([{ id: 1 }, { id: 2 }]);

    await expect(RedisUtils.increment('cmms:test:counter')).resolves.toBe(1);
    await expect(RedisUtils.decrement('cmms:test:counter')).resolves.toBe(0);
  });

  it('deletes by key and scan pattern without using Redis KEYS', async () => {
    await RedisUtils.set('cmms:test:pattern:1', 'a');
    await RedisUtils.set('cmms:test:pattern:2', 'b');
    await RedisUtils.set('cmms:test:other', 'c');

    await RedisUtils.deleteByPattern('cmms:test:pattern:*');

    await expect(RedisUtils.exists('cmms:test:pattern:1')).resolves.toBe(false);
    await expect(RedisUtils.exists('cmms:test:pattern:2')).resolves.toBe(false);
    await expect(RedisUtils.exists('cmms:test:other')).resolves.toBe(true);
  });

  it('treats missing Redis client as a no-op fallback', async () => {
    (getRedisClient as jest.Mock).mockReturnValue(null);

    await expect(RedisUtils.set('cmms:test:no-client', 'value')).resolves.toBeUndefined();
    await expect(RedisUtils.get('cmms:test:no-client')).resolves.toBeNull();
    await expect(RedisUtils.getList('cmms:test:no-client')).resolves.toEqual([]);
  });

  it('blocks flush in production', async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    await expect(RedisUtils.flush()).rejects.toThrow('Redis flush is disabled in production');

    process.env.NODE_ENV = previousNodeEnv;
  });
});
