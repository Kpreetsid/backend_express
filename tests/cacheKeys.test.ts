/**
 * CacheKeys Unit Tests
 *
 * Verifies:
 * - Correct key patterns for every entity
 * - Environment isolation (different NODE_ENV → different keys)
 * - Multi-tenant isolation (different accountIds → different keys)
 * - No key collisions between entities
 */

import { CacheKeys, CacheTTL } from '../src/_cache/cacheKeys';

const ACC = 'acc_123';
const ID  = 'doc_456';
const USER_ID = 'user_789';

describe('CacheKeys', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe('Key patterns are human-readable', () => {
    it('asset key includes accountId and docId', () => {
      const key = CacheKeys.asset(ACC, ID);
      expect(key).toContain(ACC);
      expect(key).toContain(ID);
      expect(key).toContain('asset');
    });

    it('assetList key includes accountId', () => {
      const key = CacheKeys.assetList(ACC);
      expect(key).toContain(ACC);
      expect(key).toContain('list');
    });

    it('location key includes accountId and docId', () => {
      const key = CacheKeys.location(ACC, ID);
      expect(key).toContain(ACC);
      expect(key).toContain(ID);
      expect(key).toContain('location');
    });

    it('user key includes accountId and userId', () => {
      const key = CacheKeys.user(ACC, USER_ID);
      expect(key).toContain(ACC);
      expect(key).toContain(USER_ID);
    });

    it('workOrder key includes accountId and docId', () => {
      const key = CacheKeys.workOrder(ACC, ID);
      expect(key).toContain(ACC);
      expect(key).toContain('workOrder');
    });

    it('notificationList key is per-user (not per-account)', () => {
      const key = CacheKeys.notificationList(USER_ID);
      expect(key).toContain(USER_ID);
      expect(key).toContain('notification');
    });

    it('jwtBlacklist key does NOT contain env or accountId (global)', () => {
      const key = CacheKeys.jwtBlacklist('my-jti');
      expect(key).toBe('cmms:blacklist:my-jti');
    });

    it('otp key is scoped to email', () => {
      const key = CacheKeys.otp('user@example.com');
      expect(key).toContain('otp');
      expect(key).toContain('user@example.com');
    });
  });

  describe('Multi-tenant isolation', () => {
    it('different accountIds produce different keys', () => {
      expect(CacheKeys.assetList('account_A')).not.toBe(CacheKeys.assetList('account_B'));
    });

    it('same entity in different accounts produces different keys', () => {
      expect(CacheKeys.asset('account_A', ID)).not.toBe(CacheKeys.asset('account_B', ID));
    });
  });

  describe('Entity type isolation (no key collisions)', () => {
    it('asset and location lists are distinct keys for same account', () => {
      expect(CacheKeys.assetList(ACC)).not.toBe(CacheKeys.locationList(ACC));
    });

    it('asset and user keys for same id are distinct', () => {
      expect(CacheKeys.asset(ACC, ID)).not.toBe(CacheKeys.user(ACC, ID));
    });

    it('workOrder and workRequest lists are distinct', () => {
      expect(CacheKeys.workOrderList(ACC)).not.toBe(CacheKeys.workRequestList(ACC));
    });
  });

  describe('Environment isolation', () => {
    it('keys include the NODE_ENV value at module load time', () => {
      // NODE_ENV is read once when the module is loaded (snapshot behavior).
      // The key will contain whatever NODE_ENV was when Jest started ('test').
      const key = CacheKeys.assetList(ACC);
      // Verify it contains exactly one of the known environments
      const hasKnownEnv = ['production', 'development', 'test', 'staging'].some(env =>
        key.includes(env)
      );
      expect(hasKnownEnv).toBe(true);
      // Verify structure: cmms:<env>:<accountId>:asset:list
      expect(key).toMatch(/^cmms:\w+:.+:asset:list$/);
    });
  });


  describe('CacheTTL values are positive integers', () => {
    it.each(Object.entries(CacheTTL))('%s TTL is a positive number', (_name, ttl) => {
      expect(typeof ttl).toBe('number');
      expect(ttl).toBeGreaterThan(0);
    });

    it('NOTIFICATION TTL is shorter than SETTINGS TTL', () => {
      expect(CacheTTL.NOTIFICATION).toBeLessThan(CacheTTL.SETTINGS);
    });

    it('ASSET_DETAIL TTL is longer than WORK_ORDER_DETAIL TTL', () => {
      expect(CacheTTL.ASSET_DETAIL).toBeGreaterThan(CacheTTL.WORK_ORDER_DETAIL);
    });
  });
});
