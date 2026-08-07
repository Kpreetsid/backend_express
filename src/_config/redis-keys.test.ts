import { describe, expect, it, vi } from 'vitest';

vi.mock('../configDB', () => ({
  redisConfig: {
    keyPrefix: 'cmms:{test}'
  },
  queueConfig: {
    prefix: 'cmms:{test}:global:queue'
  },
  payloadCrypto: {
    replayTtlSeconds: 300
  }
}));

import {
  REDIS_KEY_FAMILY_REGISTRY,
  redisKeys
} from './redis-keys';

describe('central Redis key registry', () => {
  it('uses the environment, tenant, domain, and identifier key shape', () => {
    expect(redisKeys.rateLimitPrefix('auth'))
      .toBe('cmms:{test}:global:rate-limit:auth:');
    expect(redisKeys.socketAdapterPrefix())
      .toBe('cmms:{test}:global:notification-socket');
    expect(redisKeys.queuePrefix())
      .toBe('cmms:{test}:global:queue');
    expect(redisKeys.payloadCryptoReplay(
      'tenant-a',
      'sensitive-key-id',
      'sensitive-nonce'
    )).toMatch(/^cmms:\{test\}:tenant-a:payload-crypto-replay:[0-9a-f]{64}$/);
  });

  it('does not expose crypto key material or nonces in Redis identifiers', () => {
    const key = redisKeys.payloadCryptoReplay(
      'tenant-a',
      'sensitive-key-id',
      'sensitive-nonce'
    );
    expect(key).not.toContain('sensitive-key-id');
    expect(key).not.toContain('sensitive-nonce');
  });

  it('registers ownership, TTL, cardinality, classification, and failure policy', () => {
    for (const family of Object.values(REDIS_KEY_FAMILY_REGISTRY)) {
      expect(family.owner).toBeTruthy();
      expect(family.ttlPolicy).toBeTruthy();
      expect(family.cardinality).toBeTruthy();
      expect(family.classification).toBeTruthy();
      expect(family.failurePolicy).toBeTruthy();
    }
  });
});
