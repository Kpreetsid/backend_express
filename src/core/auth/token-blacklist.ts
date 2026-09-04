/**
 * TokenBlacklist — Redis-backed JWT revocation store.
 *
 * On logout, a JWT's unique identifier (jti or token string) is stored in Redis
 * with a TTL matching the token's remaining lifetime. Any middleware can then
 * check isBlacklisted() to reject invalidated tokens without a DB query.
 *
 * Key pattern: cmms:blacklist:{jti}
 *
 * SECURITY: This is the source of truth for revoked tokens. Redis unavailability
 * will fail-open (tokens are NOT blocked if Redis is down) — acceptable trade-off
 * vs. blocking all authenticated requests during a Redis outage.
 */

import { getRedisClient } from '../cache/redis.client';
import { CacheKeys } from '../cache/cache.keys';

export const TokenBlacklist = {
  /**
   * Blacklist a token for its remaining lifetime.
   *
   * @param jti     - The token's unique identifier (or the raw token string)
   * @param ttlSeconds - Time until the token naturally expires (seconds)
   */
  async add(jti: string, ttlSeconds: number): Promise<void> {
    if (ttlSeconds <= 0) return; // already expired — no need to store
    const client = getRedisClient();
    if (!client) {
      console.warn('[TokenBlacklist] Redis unavailable — token NOT blacklisted');
      return;
    }
    const key = CacheKeys.jwtBlacklist(jti);
    await client.set(key, '1', 'EX', ttlSeconds);
    console.debug(`[TokenBlacklist] Blacklisted jti="${jti}" for ${ttlSeconds}s`);
  },

  /**
   * Check if a token has been revoked.
   * Returns false (not blacklisted) on Redis errors — fail-open approach.
   *
   * @param jti - The token's unique identifier
   */
  async isBlacklisted(jti: string): Promise<boolean> {
    const client = getRedisClient();
    if (!client) return false; // fail-open: Redis down → allow token
    try {
      const key = CacheKeys.jwtBlacklist(jti);
      const result = await client.exists(key);
      return result === 1;
    } catch {
      return false;
    }
  },
};
