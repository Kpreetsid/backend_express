import { beforeEach, describe, expect, it, vi } from 'vitest';

const redisHarness = vi.hoisted(() => ({
  enabled: true,
  ready: true,
  set: vi.fn()
}));

vi.mock('../configDB', () => ({
  auth: {
    expiresIn: '1h'
  },
  payloadCrypto: {
    enabled: true,
    strictMode: false,
    requestDecryptEnabled: true,
    responseEncryptEnabled: true,
    masterSecret: 'payload-master-secret-with-at-least-32-characters',
    bootstrapTtlSeconds: 300,
    replayTtlSeconds: 300
  },
  redisConfig: {
    get enabled() {
      return redisHarness.enabled;
    },
    keyPrefix: 'cmms:{test}'
  },
  queueConfig: {
    prefix: 'cmms:{test}:global:queue'
  }
}));

vi.mock('./redis', () => ({
  getRedisClient: vi.fn(() => redisHarness.ready ? {
    isReady: true,
    set: redisHarness.set
  } : undefined)
}));

import { payloadCryptoService } from './payloadCrypto';
import { payloadCrypto } from '../configDB';
import crypto from 'crypto';

const createRecord = () => {
  const metadata = payloadCryptoService.createAuthenticatedSession({
    token: 'access-token',
    tokenId: 'session-a',
    userId: 'user-a',
    accountId: 'tenant-a'
  });
  return {
    metadata,
    record: payloadCryptoService.getKeyRecord(metadata.keyId)
  };
};

describe('distributed payload crypto state', () => {
  beforeEach(() => {
    redisHarness.enabled = true;
    redisHarness.ready = true;
    redisHarness.set.mockReset();
    redisHarness.set.mockResolvedValue('OK');
    (payloadCryptoService as any).bootstrapKeys.clear();
    (payloadCryptoService as any).sessionKeys.clear();
    payloadCrypto.enabled = true;
    payloadCrypto.strictMode = false;
    payloadCrypto.requestDecryptEnabled = true;
    payloadCrypto.responseEncryptEnabled = true;
    payloadCrypto.masterSecret = 'payload-master-secret-with-at-least-32-characters';
    payloadCrypto.bootstrapTtlSeconds = 300;
    payloadCrypto.replayTtlSeconds = 300;
  });

  it('seals key records so another API instance can recover them', () => {
    const { metadata } = createRecord();
    expect(metadata.keyId).toMatch(/^v1\./);

    (payloadCryptoService as any).sessionKeys.clear();
    const recovered = payloadCryptoService.getKeyRecord(metadata.keyId);

    expect(recovered).toMatchObject({
      keyId: metadata.keyId,
      kind: 'session',
      sessionId: 'session-a',
      userId: 'user-a',
      accountId: 'tenant-a'
    });
    expect(recovered.key.toString('base64')).toBe(metadata.sessionKey);
  });

  it('retains AES-GCM request and response compatibility with a recovered record', () => {
    const { metadata } = createRecord();
    (payloadCryptoService as any).sessionKeys.clear();
    const recovered = payloadCryptoService.getKeyRecord(metadata.keyId);
    const envelope = payloadCryptoService.encryptJson(
      { status: true, data: { id: 'asset-a' } },
      recovered,
      'request|POST|/api/master/assets|tenant-a|user-a|1|nonce'
    );

    expect(payloadCryptoService.decryptJson(
      envelope,
      recovered,
      'request|POST|/api/master/assets|tenant-a|user-a|1|nonce'
    )).toEqual({ status: true, data: { id: 'asset-a' } });
  });

  it('atomically rejects a replay across API instances through Redis', async () => {
    const { record } = createRecord();
    redisHarness.set
      .mockResolvedValueOnce('OK')
      .mockResolvedValueOnce(null);
    const timestamp = Date.now().toString();

    await expect(payloadCryptoService.validateReplay(
      record,
      timestamp,
      'nonce-a'
    )).resolves.toEqual({ timestamp, nonce: 'nonce-a' });
    await expect(payloadCryptoService.validateReplay(
      record,
      timestamp,
      'nonce-a'
    )).rejects.toMatchObject({
      status: 409,
      message: 'Payload crypto request replay detected'
    });

    expect(redisHarness.set).toHaveBeenCalledWith(
      expect.stringMatching(
        /^cmms:\{test\}:tenant-a:payload-crypto-replay:[0-9a-f]{64}$/
      ),
      '1',
      { NX: true, PX: 300_000 }
    );
  });

  it('fails closed when distributed replay protection is unavailable', async () => {
    const { record } = createRecord();
    redisHarness.ready = false;

    await expect(payloadCryptoService.validateReplay(
      record,
      Date.now().toString(),
      'nonce-a'
    )).rejects.toMatchObject({
      status: 503,
      message: 'Distributed payload replay protection is unavailable'
    });
  });

  it('keeps the process-local replay guard for non-Redis development', async () => {
    const { record } = createRecord();
    redisHarness.enabled = false;
    const timestamp = Date.now().toString();

    await payloadCryptoService.validateReplay(record, timestamp, 'nonce-local');
    await expect(payloadCryptoService.validateReplay(
      record,
      timestamp,
      'nonce-local'
    )).rejects.toMatchObject({ status: 409 });
  });

  it('reports each configured payload-crypto capability without changing policy', () => {
    expect(payloadCryptoService.isEnabled()).toBe(true);
    expect(payloadCryptoService.isStrictMode()).toBe(false);
    expect(payloadCryptoService.canDecryptRequests()).toBe(true);
    expect(payloadCryptoService.canEncryptResponses()).toBe(true);

    payloadCrypto.enabled = false;
    expect(payloadCryptoService.isEnabled()).toBe(false);
    expect(payloadCryptoService.canDecryptRequests()).toBe(false);
    expect(payloadCryptoService.canEncryptResponses()).toBe(false);
  });

  it('creates and recovers a standards-compatible ECDH bootstrap session', () => {
    const client = crypto.createECDH('prime256v1');
    const clientPublicKey = client.generateKeys().toString('base64');

    const metadata = payloadCryptoService.createBootstrapSession(
      clientPublicKey,
      'client-nonce'
    );

    expect(metadata).toMatchObject({
      enabled: true,
      algorithm: 'AES-256-GCM'
    });
    expect(metadata.keyId).toMatch(/^v1\./);
    expect(Buffer.from(metadata.serverPublicKey, 'base64').length).toBeGreaterThan(0);
    (payloadCryptoService as any).bootstrapKeys.clear();
    expect(payloadCryptoService.getKeyRecord(metadata.keyId).kind).toBe('bootstrap');
  });

  it('rejects disabled, incomplete, and invalid bootstrap attempts', () => {
    payloadCrypto.enabled = false;
    expect(() => payloadCryptoService.createBootstrapSession('key', 'nonce'))
      .toThrow('Payload crypto is disabled');

    payloadCrypto.enabled = true;
    expect(() => payloadCryptoService.createBootstrapSession('', 'nonce'))
      .toThrow('Crypto bootstrap requires client public key and nonce');
    expect(() => payloadCryptoService.createBootstrapSession('not-a-public-key', 'nonce'))
      .toThrow('Invalid crypto bootstrap key');
  });

  it.each([
    ['1s', 1],
    ['2m', 120],
    ['3h', 10_800],
    ['2d', 172_800],
    ['45', 45],
    ['invalid', 86_400],
    [undefined, 86_400]
  ])('parses authentication duration %s as %s seconds', (duration, expected) => {
    expect((payloadCryptoService as any).parseDurationSeconds(duration)).toBe(expected);
  });

  it('rejects missing, malformed, tampered, and expired sealed key records', () => {
    expect(() => payloadCryptoService.getKeyRecord('missing'))
      .toThrow('Payload crypto key is invalid or expired');
    expect(() => payloadCryptoService.getKeyRecord('v1.invalid.value'))
      .toThrow('Payload crypto key is invalid or expired');

    const { metadata } = createRecord();
    (payloadCryptoService as any).sessionKeys.clear();
    const replacement = metadata.keyId.endsWith('x') ? 'y' : 'x';
    const tampered = `${metadata.keyId.slice(0, -1)}${replacement}`;
    expect(() => payloadCryptoService.getKeyRecord(tampered))
      .toThrow('Payload crypto key is invalid or expired');

    const expiredRecord = {
      keyId: 'temporary',
      sessionId: 'expired-session',
      kind: 'session',
      key: crypto.randomBytes(32),
      expiresAt: Date.now() - 1,
      usedNonces: new Map()
    };
    const expiredKeyId = (payloadCryptoService as any).sealKeyRecord(expiredRecord);
    expect(() => payloadCryptoService.getKeyRecord(expiredKeyId))
      .toThrow('Payload crypto key expired');
  });

  it('rejects structurally invalid sealed plaintext after authentic decryption', () => {
    const invalidRecords = [
      {
        keyId: 'temporary',
        sessionId: 'session',
        kind: 'invalid',
        key: crypto.randomBytes(32),
        expiresAt: Date.now() + 60_000,
        usedNonces: new Map()
      },
      {
        keyId: 'temporary',
        sessionId: '',
        kind: 'session',
        key: crypto.randomBytes(16),
        expiresAt: Number.NaN,
        usedNonces: new Map()
      }
    ];

    for (const record of invalidRecords) {
      const keyId = (payloadCryptoService as any).sealKeyRecord(record);
      expect((payloadCryptoService as any).openKeyRecord(keyId)).toBeUndefined();
    }
  });

  it('validates replay header shape, age, local expiry, and Redis outages', async () => {
    const { record } = createRecord();
    await expect(payloadCryptoService.validateReplay(record, '', 'nonce'))
      .rejects.toMatchObject({ status: 400 });
    await expect(payloadCryptoService.validateReplay(record, 'not-a-number', 'nonce'))
      .rejects.toMatchObject({ status: 400 });
    await expect(payloadCryptoService.validateReplay(
      record,
      String(Date.now() - 301_000),
      'nonce'
    )).rejects.toMatchObject({ status: 401 });

    redisHarness.set.mockRejectedValueOnce(new Error('Redis network error'));
    await expect(payloadCryptoService.validateReplay(
      record,
      String(Date.now()),
      'nonce-redis-error'
    )).rejects.toMatchObject({ status: 503 });

    redisHarness.enabled = false;
    record.usedNonces.set('reusable', Date.now() - 1);
    await expect(payloadCryptoService.validateReplay(
      record,
      String(Date.now()),
      'reusable'
    )).resolves.toMatchObject({ nonce: 'reusable' });
  });

  it('encrypts bytes and rejects key mismatch, malformed envelopes, and wrong AAD', () => {
    const { record } = createRecord();
    const envelope = payloadCryptoService.encryptBytes(
      Buffer.from('payload'),
      record,
      'request|POST|/api'
    );

    expect(payloadCryptoService.decryptBytes(
      envelope,
      record,
      'request|POST|/api'
    ).toString()).toBe('payload');
    expect(() => payloadCryptoService.decryptBytes(
      { ...envelope, kid: 'different-key' },
      record,
      'request|POST|/api'
    )).toThrow('Encrypted payload key mismatch');
    expect(() => payloadCryptoService.decryptBytes(
      envelope,
      record,
      'wrong-aad'
    )).toThrow('Invalid encrypted payload');
    expect(() => payloadCryptoService.decryptJson(
      payloadCryptoService.encryptBytes(Buffer.from('not-json'), record, 'aad'),
      record,
      'aad'
    )).toThrow();
  });

  it('strictly recognizes envelopes and normalizes request AAD paths', () => {
    const { record } = createRecord();
    const valid = payloadCryptoService.encryptJson({ ok: true }, record, 'aad');
    expect(payloadCryptoService.isEnvelope(valid)).toBe(true);
    for (const invalid of [
      null,
      {},
      { ...valid, _encrypted: false },
      { ...valid, version: 2 },
      { ...valid, alg: 'AES-CBC' },
      { ...valid, kid: 1 },
      { ...valid, iv: 1 },
      { ...valid, tag: 1 },
      { ...valid, ct: 1 }
    ]) {
      expect(payloadCryptoService.isEnvelope(invalid)).toBe(false);
    }

    expect(payloadCryptoService.buildAad({
      originalUrl: '/cmms_express//api/master/assets/?page=1',
      url: '/',
      method: 'post',
      headers: { accountid: 'tenant-a' }
    } as any, record, '123', 'nonce')).toBe(
      'request|POST|/api/master/assets|tenant-a|user-a|123|nonce'
    );
    expect(payloadCryptoService.buildAad({
      originalUrl: '',
      url: '/api',
      method: 'get',
      headers: {}
    } as any, record, '123', 'nonce', true)).toBe(
      'response|GET|/api|tenant-a|user-a|123|nonce'
    );
  });

  it('cleans expired records and nonce entries while retaining active state', () => {
    const now = Date.now();
    const expired = {
      keyId: 'expired',
      sessionId: 'expired',
      kind: 'session',
      key: crypto.randomBytes(32),
      expiresAt: now - 1,
      usedNonces: new Map()
    };
    const active = {
      keyId: 'active',
      sessionId: 'active',
      kind: 'bootstrap',
      key: crypto.randomBytes(32),
      expiresAt: now + 60_000,
      usedNonces: new Map([
        ['expired-nonce', now - 1],
        ['active-nonce', now + 60_000]
      ])
    };
    (payloadCryptoService as any).sessionKeys.set(expired.keyId, expired);
    (payloadCryptoService as any).bootstrapKeys.set(active.keyId, active);

    (payloadCryptoService as any).cleanupExpired();

    expect((payloadCryptoService as any).sessionKeys.has('expired')).toBe(false);
    expect(active.usedNonces.has('expired-nonce')).toBe(false);
    expect(active.usedNonces.has('active-nonce')).toBe(true);
  });
});
