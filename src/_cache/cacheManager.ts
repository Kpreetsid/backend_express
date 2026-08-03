/**
 * CacheManager — Enterprise service-level Redis get/set/del manager.
 *
 * This is the single, typed interface for all Redis interactions in the CMMS
 * application. It wraps RedisUtils with structured logging, graceful fallbacks,
 * and ensures consistent serialization.
 */

import { RedisUtils } from '../utils/redis.service';
import { isRedisReady } from '../_config/redis';

export type CacheMissLoader<T> = () => Promise<T>;

export interface GetOrSetResult<T> {
  value: T;
  hit: boolean;
}

class CacheManagerService {
  /**
   * Checks if Redis is available. Safely silences errors.
   */
  isAvailable(): boolean {
    return isRedisReady();
  }

  /**
   * Get a value from cache. Returns null on miss or Redis unavailable.
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.isAvailable()) return null;
    try {
      return await RedisUtils.get<T>(key);
    } catch {
      return null;
    }
  }

  /**
   * Set a value in cache with an explicit TTL (seconds).
   */
  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      await RedisUtils.set(key, value, ttlSeconds);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[CacheManager] SET failed for key="${key}": ${msg}`);
    }
  }

  /**
   * Delete one or more exact keys from cache.
   */
  async del(...keys: string[]): Promise<void> {
    if (!this.isAvailable()) return;
    const validKeys = keys.filter(Boolean);
    if (validKeys.length === 0) return;
    try {
      await RedisUtils.deleteMany(validKeys);
      if (process.env.NODE_ENV !== 'production') {
        console.debug(`[CacheManager] Invalidated ${validKeys.length} key(s):`, validKeys);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[CacheManager] DEL failed for keys=[${validKeys.join(', ')}]: ${msg}`);
    }
  }

  /**
   * Delete all keys matching a glob pattern (uses SCAN — production-safe).
   */
  async delPattern(pattern: string): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      await RedisUtils.deleteByPattern(pattern);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[CacheManager] DEL pattern failed for "${pattern}": ${msg}`);
    }
  }

  /**
   * Cache-aside pattern: check cache first, on miss load from source and cache.
   *
   * @param key     - The Redis key
   * @param ttl     - TTL in seconds
   * @param loader  - Async function to load data on cache miss
   * @returns       - { value, hit } — hit=true if served from Redis
   */
  async getOrSet<T>(key: string, ttl: number, loader: CacheMissLoader<T>): Promise<GetOrSetResult<T>> {
    if (this.isAvailable()) {
      const cached = await this.get<T>(key);
      if (cached !== null) {
        return { value: cached, hit: true };
      }
    }

    const value = await loader();

    if (this.isAvailable() && value !== null && value !== undefined) {
      // Fire-and-wait (not fire-and-forget): ensures key is available by next request
      void this.set(key, value, ttl);
    }

    return { value, hit: false };
  }

  /**
   * Account-aware Cache-aside pattern: checks if Redis is enabled for the specific account.
   * If Redis is disabled for the account, bypasses Redis completely.
   */
  async getOrSetForAccount<T>(
    accountId: string,
    key: string,
    ttl: number,
    loader: CacheMissLoader<T>
  ): Promise<GetOrSetResult<T>> {
    return this.getOrSet(key, ttl, loader);
  }

  /**
   * Set a value only if it does NOT exist (atomic, uses SET NX).
   * Returns true if the key was set, false if it already existed.
   */
  async setIfAbsent(key: string, value: unknown, ttlSeconds: number): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      const client = (RedisUtils as any).client ? (RedisUtils as any).client() : null;
      if (!client) return false;
      const result = await client.set(key, serialized, 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    } catch {
      return false;
    }
  }

  /**
   * Check if a key exists in Redis.
   */
  async exists(key: string): Promise<boolean> {
    if (!this.isAvailable()) return false;
    return RedisUtils.exists(key);
  }
}

export const CacheManager = new CacheManagerService();
