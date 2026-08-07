import crypto from 'node:crypto';
import {
  payloadCrypto,
  queueConfig,
  redisConfig
} from '../configDB';

export const REDIS_KEY_FAMILY_REGISTRY = Object.freeze({
  rateLimit: {
    owner: 'HTTP platform',
    ttlPolicy: 'Limiter window; no manual invalidation',
    cardinality: 'Bounded by source identity and route scope',
    classification: 'Internal',
    failurePolicy: 'Fail closed when production Redis is required'
  },
  socketNotifications: {
    owner: 'Notification Socket.IO adapter',
    ttlPolicy: 'Adapter-managed ephemeral state',
    cardinality: 'Bounded by active notification connections and rooms',
    classification: 'Confidential',
    failurePolicy: 'Readiness fails closed before multi-instance traffic'
  },
  queue: {
    owner: 'BullMQ/outbox worker platform',
    ttlPolicy: 'Completed jobs 24 hours; failed jobs retained for redrive',
    cardinality: 'Bounded by queue retention and operational redrive policy',
    classification: 'Confidential',
    failurePolicy: 'Production readiness and writes fail closed'
  },
  payloadCryptoReplay: {
    owner: 'Payload crypto middleware',
    ttlPolicy: `${payloadCrypto.replayTtlSeconds} seconds`,
    cardinality: 'One key per accepted request nonce inside the replay window',
    classification: 'Restricted',
    failurePolicy: 'Fail closed when distributed replay protection is unavailable'
  }
});

const cleanPrefix = (value: string): string =>
  value.trim().replace(/:+$/, '');

const cleanSegment = (value: unknown, fallback: string): string => {
  const normalized = String(value ?? '')
    .trim()
    .replace(/[^A-Za-z0-9._-]/g, '_')
    .slice(0, 128);
  return normalized || fallback;
};

const basePrefix = (): string => cleanPrefix(redisConfig.keyPrefix);

export const redisKeys = Object.freeze({
  rateLimitPrefix(scope: string): string {
    return `${basePrefix()}:global:rate-limit:${cleanSegment(scope, 'global')}:`;
  },

  socketAdapterPrefix(): string {
    return `${basePrefix()}:global:notification-socket`;
  },

  queuePrefix(): string {
    return cleanPrefix(queueConfig.prefix);
  },

  payloadCryptoReplay(
    tenantId: unknown,
    keyId: string,
    nonce: string
  ): string {
    const identifier = crypto
      .createHash('sha256')
      .update(`${keyId}\u0000${nonce}`)
      .digest('hex');
    return `${basePrefix()}:${cleanSegment(tenantId, 'global')}:payload-crypto-replay:${identifier}`;
  }
});
