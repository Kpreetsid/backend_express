import crypto from 'crypto';
import { Request } from 'express';
import { auth, payloadCrypto, redisConfig } from '../configDB';
import { getRedisClient } from './redis';
import { redisKeys } from './redis-keys';

export interface PayloadCryptoEnvelope {
  _encrypted: true;
  version: 1;
  alg: 'AES-256-GCM';
  kid: string;
  iv: string;
  tag: string;
  ct: string;
}

export interface PayloadCryptoSessionMetadata {
  enabled: true;
  keyId: string;
  sessionId: string;
  sessionKey: string;
  expiresAt: string;
  algorithm: 'AES-256-GCM';
  userId: string;
  accountId: string;
}

export interface PayloadCryptoKeyRecord {
  keyId: string;
  sessionId: string;
  kind: 'bootstrap' | 'session';
  key: Buffer;
  expiresAt: number;
  userId?: string;
  accountId?: string;
  token?: string;
  usedNonces: Map<string, number>;
}

const encoder = new TextEncoder();
const sealedKeyAad = Buffer.from('cmms-payload-key-v1', 'utf8');

class PayloadCryptoService {
  private readonly bootstrapKeys = new Map<string, PayloadCryptoKeyRecord>();
  private readonly sessionKeys = new Map<string, PayloadCryptoKeyRecord>();

  isEnabled(): boolean {
    return payloadCrypto.enabled;
  }

  isStrictMode(): boolean {
    return payloadCrypto.strictMode;
  }

  canDecryptRequests(): boolean {
    return payloadCrypto.enabled && payloadCrypto.requestDecryptEnabled;
  }

  canEncryptResponses(): boolean {
    return payloadCrypto.enabled && payloadCrypto.responseEncryptEnabled;
  }

  createBootstrapSession(clientPublicKey: string, clientNonce: string) {
    if (!payloadCrypto.enabled) {
      throw Object.assign(new Error('Payload crypto is disabled'), { status: 404 });
    }

    if (!clientPublicKey || !clientNonce) {
      throw Object.assign(new Error('Crypto bootstrap requires client public key and nonce'), { status: 400 });
    }

    const serverEcdh = crypto.createECDH('prime256v1');
    const serverPublicKey = serverEcdh.generateKeys();
    let sharedSecret: Buffer;

    try {
      sharedSecret = serverEcdh.computeSecret(Buffer.from(clientPublicKey, 'base64'));
    } catch {
      throw Object.assign(new Error('Invalid crypto bootstrap key'), { status: 400, name: 'BadRequestError' });
    }

    const serverNonce = this.randomId(24);
    const key = this.deriveBootstrapKey(sharedSecret, clientNonce, serverNonce);
    const now = Date.now();
    const record: PayloadCryptoKeyRecord = {
      keyId: this.randomId(24),
      sessionId: this.randomId(24),
      kind: 'bootstrap',
      key,
      expiresAt: now + payloadCrypto.bootstrapTtlSeconds * 1000,
      usedNonces: new Map()
    };

    this.registerKeyRecord(record, this.bootstrapKeys);
    this.cleanupExpired();

    return {
      enabled: true,
      keyId: record.keyId,
      sessionId: record.sessionId,
      serverPublicKey: serverPublicKey.toString('base64'),
      serverNonce,
      expiresAt: new Date(record.expiresAt).toISOString(),
      algorithm: 'AES-256-GCM'
    };
  }

  createAuthenticatedSession(input: {
    token: string;
    tokenId?: string;
    userId: string;
    accountId: string;
  }): PayloadCryptoSessionMetadata {
    const ttlSeconds = this.parseDurationSeconds(auth.expiresIn);
    const now = Date.now();
    const key = crypto.randomBytes(32);
    const record: PayloadCryptoKeyRecord = {
      keyId: this.randomId(24),
      sessionId: input.tokenId || this.randomId(24),
      kind: 'session',
      key,
      expiresAt: now + ttlSeconds * 1000,
      userId: input.userId,
      accountId: input.accountId,
      usedNonces: new Map()
    };

    this.registerKeyRecord(record, this.sessionKeys);
    this.cleanupExpired();

    return {
      enabled: true,
      keyId: record.keyId,
      sessionId: record.sessionId,
      sessionKey: key.toString('base64'),
      expiresAt: new Date(record.expiresAt).toISOString(),
      algorithm: 'AES-256-GCM',
      userId: input.userId,
      accountId: input.accountId
    };
  }

  getKeyRecord(keyId: string): PayloadCryptoKeyRecord {
    this.cleanupExpired();
    const record = this.sessionKeys.get(keyId)
      || this.bootstrapKeys.get(keyId)
      || this.openKeyRecord(keyId);
    if (!record) {
      throw Object.assign(new Error('Payload crypto key is invalid or expired'), { status: 401, name: 'InvalidTokenError' });
    }
    if (record.expiresAt <= Date.now()) {
      this.sessionKeys.delete(keyId);
      this.bootstrapKeys.delete(keyId);
      throw Object.assign(new Error('Payload crypto key expired'), { status: 401, name: 'TokenExpiredError' });
    }
    if (!this.sessionKeys.has(keyId) && !this.bootstrapKeys.has(keyId)) {
      const target = record.kind === 'session' ? this.sessionKeys : this.bootstrapKeys;
      target.set(keyId, record);
    }
    return record;
  }

  async validateReplay(
    record: PayloadCryptoKeyRecord,
    timestampHeader: unknown,
    nonceHeader: unknown
  ): Promise<{ timestamp: string; nonce: string }> {
    const timestamp = String(timestampHeader || '');
    const nonce = String(nonceHeader || '');
    const timestampMs = Number(timestamp);
    const now = Date.now();

    if (!timestamp || !nonce || !Number.isFinite(timestampMs)) {
      throw Object.assign(new Error('Invalid payload crypto replay headers'), { status: 400, name: 'BadRequestError' });
    }
    if (Math.abs(now - timestampMs) > payloadCrypto.replayTtlSeconds * 1000) {
      throw Object.assign(new Error('Payload crypto request expired'), { status: 401, name: 'TokenExpiredError' });
    }

    const ttlMs = payloadCrypto.replayTtlSeconds * 1000;
    if (redisConfig.enabled) {
      const redis = getRedisClient();
      if (!redis?.isReady) {
        throw Object.assign(
          new Error('Distributed payload replay protection is unavailable'),
          { status: 503, name: 'ServiceUnavailableError' }
        );
      }
      try {
        const accepted = await redis.set(
          redisKeys.payloadCryptoReplay(record.accountId, record.keyId, nonce),
          '1',
          { NX: true, PX: ttlMs }
        );
        if (accepted !== 'OK') {
          throw Object.assign(
            new Error('Payload crypto request replay detected'),
            { status: 409, name: 'ConflictError' }
          );
        }
      } catch (error: any) {
        if (error?.status === 409) throw error;
        throw Object.assign(
          new Error('Distributed payload replay protection is unavailable'),
          { status: 503, name: 'ServiceUnavailableError', cause: error }
        );
      }
      return { timestamp, nonce };
    }

    this.cleanupNonces(record);
    if (record.usedNonces.has(nonce)) {
      throw Object.assign(new Error('Payload crypto request replay detected'), { status: 409, name: 'ConflictError' });
    }
    record.usedNonces.set(nonce, now + ttlMs);
    return { timestamp, nonce };
  }

  encryptJson(value: unknown, record: PayloadCryptoKeyRecord, aad: string): PayloadCryptoEnvelope {
    return this.encryptBytes(Buffer.from(JSON.stringify(value ?? null), 'utf8'), record, aad);
  }

  encryptBytes(plaintext: Buffer, record: PayloadCryptoKeyRecord, aad: string): PayloadCryptoEnvelope {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', record.key, iv);
    cipher.setAAD(Buffer.from(aad, 'utf8'));
    const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
      _encrypted: true,
      version: 1,
      alg: 'AES-256-GCM',
      kid: record.keyId,
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      ct: ct.toString('base64')
    };
  }

  decryptJson(envelope: PayloadCryptoEnvelope, record: PayloadCryptoKeyRecord, aad: string): unknown {
    const plaintext = this.decryptBytes(envelope, record, aad);
    return JSON.parse(plaintext.toString('utf8'));
  }

  decryptBytes(envelope: PayloadCryptoEnvelope, record: PayloadCryptoKeyRecord, aad: string): Buffer {
    this.assertEnvelope(envelope, record);
    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', record.key, Buffer.from(envelope.iv, 'base64'));
      decipher.setAAD(Buffer.from(aad, 'utf8'));
      decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
      return Buffer.concat([
        decipher.update(Buffer.from(envelope.ct, 'base64')),
        decipher.final()
      ]);
    } catch {
      throw Object.assign(new Error('Invalid encrypted payload'), { status: 400, name: 'BadRequestError' });
    }
  }

  isEnvelope(value: unknown): value is PayloadCryptoEnvelope {
    return !!value
      && typeof value === 'object'
      && (value as any)._encrypted === true
      && (value as any).version === 1
      && (value as any).alg === 'AES-256-GCM'
      && typeof (value as any).kid === 'string'
      && typeof (value as any).iv === 'string'
      && typeof (value as any).tag === 'string'
      && typeof (value as any).ct === 'string';
  }

  buildAad(req: Request, record: PayloadCryptoKeyRecord, timestamp: string, nonce: string, response: boolean = false): string {
    const url = new URL(req.originalUrl || req.url || '/', 'http://cmms.local');
    const accountId = String(req.headers['accountid'] || record.accountId || '');
    const userId = record.userId || '';
    return [
      response ? 'response' : 'request',
      req.method.toUpperCase(),
      this.normalizePath(url.pathname),
      accountId,
      userId,
      timestamp,
      nonce
    ].join('|');
  }

  private deriveBootstrapKey(sharedSecret: Buffer, clientNonce: string, serverNonce: string): Buffer {
    return Buffer.from(crypto.hkdfSync(
      'sha256',
      sharedSecret,
      encoder.encode(`${clientNonce}:${serverNonce}`),
      encoder.encode('cmms-payload-bootstrap-v1'),
      32
    ));
  }

  private registerKeyRecord(
    record: PayloadCryptoKeyRecord,
    target: Map<string, PayloadCryptoKeyRecord>
  ): void {
    if (payloadCrypto.masterSecret) {
      record.keyId = this.sealKeyRecord(record);
    }
    target.set(record.keyId, record);
  }

  private sealKeyRecord(record: PayloadCryptoKeyRecord): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(
      'aes-256-gcm',
      this.getSealingKey(),
      iv
    );
    cipher.setAAD(sealedKeyAad);
    const plaintext = Buffer.from(JSON.stringify({
      kind: record.kind,
      key: record.key.toString('base64'),
      expiresAt: record.expiresAt,
      sessionId: record.sessionId,
      userId: record.userId,
      accountId: record.accountId
    }), 'utf8');
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    return [
      'v1',
      iv.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
      ciphertext.toString('base64url')
    ].join('.');
  }

  private openKeyRecord(keyId: string): PayloadCryptoKeyRecord | undefined {
    if (!payloadCrypto.masterSecret || !keyId.startsWith('v1.')) {
      return undefined;
    }
    try {
      const [version, ivValue, tagValue, ciphertextValue, extra] = keyId.split('.');
      if (
        version !== 'v1'
        || !ivValue
        || !tagValue
        || !ciphertextValue
        || extra !== undefined
      ) {
        return undefined;
      }
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        this.getSealingKey(),
        Buffer.from(ivValue, 'base64url')
      );
      decipher.setAAD(sealedKeyAad);
      decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(ciphertextValue, 'base64url')),
        decipher.final()
      ]);
      const value = JSON.parse(plaintext.toString('utf8'));
      const key = Buffer.from(String(value.key || ''), 'base64');
      if (
        !['bootstrap', 'session'].includes(value.kind)
        || key.length !== 32
        || !Number.isFinite(value.expiresAt)
        || !value.sessionId
      ) {
        return undefined;
      }
      return {
        keyId,
        sessionId: String(value.sessionId),
        kind: value.kind,
        key,
        expiresAt: Number(value.expiresAt),
        ...(value.userId ? { userId: String(value.userId) } : {}),
        ...(value.accountId ? { accountId: String(value.accountId) } : {}),
        usedNonces: new Map()
      };
    } catch {
      return undefined;
    }
  }

  private getSealingKey(): Buffer {
    return crypto
      .createHash('sha256')
      .update(String(payloadCrypto.masterSecret))
      .digest();
  }

  private assertEnvelope(envelope: PayloadCryptoEnvelope, record: PayloadCryptoKeyRecord): void {
    if (!this.isEnvelope(envelope) || envelope.kid !== record.keyId) {
      throw Object.assign(new Error('Encrypted payload key mismatch'), { status: 400, name: 'BadRequestError' });
    }
  }

  private cleanupExpired(): void {
    const now = Date.now();
    for (const [keyId, record] of this.bootstrapKeys.entries()) {
      if (record.expiresAt <= now) {
        this.bootstrapKeys.delete(keyId);
      } else {
        this.cleanupNonces(record);
      }
    }
    for (const [keyId, record] of this.sessionKeys.entries()) {
      if (record.expiresAt <= now) {
        this.sessionKeys.delete(keyId);
      } else {
        this.cleanupNonces(record);
      }
    }
  }

  private cleanupNonces(record: PayloadCryptoKeyRecord): void {
    const now = Date.now();
    for (const [nonce, expiresAt] of record.usedNonces.entries()) {
      if (expiresAt <= now) {
        record.usedNonces.delete(nonce);
      }
    }
  }

  private randomId(size: number): string {
    return crypto.randomBytes(size).toString('base64url');
  }

  private parseDurationSeconds(value: string | undefined): number {
    const fallback = 24 * 60 * 60;
    if (!value) {
      return fallback;
    }
    const match = /^(\d+)([smhd])?$/.exec(String(value).trim());
    if (!match) {
      return Number.parseInt(value, 10) || fallback;
    }
    const amount = Number(match[1]);
    switch (match[2]) {
      case 's': return amount;
      case 'm': return amount * 60;
      case 'h': return amount * 60 * 60;
      case 'd': return amount * 24 * 60 * 60;
      default: return amount;
    }
  }

  private normalizePath(pathname: string): string {
    const normalized = pathname.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
    const apiIndex = normalized.indexOf('/api/');
    if (apiIndex >= 0) {
      return normalized.slice(apiIndex);
    }
    return normalized === '/api' ? normalized : normalized;
  }
}

export const payloadCryptoService = new PayloadCryptoService();
