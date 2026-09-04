import crypto from 'crypto';
import { redisConfig } from '../config/env.config';
import { isRedisReady } from '../cache/redis.client';
import { RedisUtils } from '../cache/redis.utils';

export type TokenPrincipalType = 'user' | 'refresh_token';

export interface TokenSessionRecord {
  tokenId?: string;
  userId: string;
  accountId?: string;
  principalType: TokenPrincipalType;
  expiresAt: string;
  isExternal?: boolean;
  isInternal?: boolean;
  userAgent?: string;
  ipAddress?: string;
}

interface SetAccessSessionInput extends TokenSessionRecord {
  token: string;
  ttlSeconds: number;
}

interface SetRefreshSessionInput extends TokenSessionRecord {
  tokenHash: string;
  ttlSeconds: number;
}

const hashToken = (token: string): string => crypto
  .createHash('sha256')
  .update(token)
  .digest('hex');

const accessKey = (token: string): string => `${redisConfig.keyPrefix}:session:access:${hashToken(token)}`;
const refreshKey = (tokenHash: string): string => `${redisConfig.keyPrefix}:session:refresh:${tokenHash}`;
const userSessionsKey = (accountId: string, userId: string): string => `${redisConfig.keyPrefix}:user-sessions:${accountId}:${userId}`;

const canUseSessionStore = (): boolean => redisConfig.enabled && redisConfig.sessionEnabled && isRedisReady();

const normalizeRecord = (record: TokenSessionRecord): TokenSessionRecord => ({
  ...record,
  tokenId: record.tokenId ? String(record.tokenId) : undefined,
  userId: String(record.userId),
  accountId: record.accountId ? String(record.accountId) : undefined,
  expiresAt: new Date(record.expiresAt).toISOString()
});

const isExpired = (record: TokenSessionRecord): boolean => new Date(record.expiresAt).getTime() <= Date.now();

const addToUserSessionIndex = async (record: TokenSessionRecord, key: string, ttlSeconds: number): Promise<void> => {
  if (!record.accountId || !record.userId || ttlSeconds <= 0) {
    return;
  }

  const indexKey = userSessionsKey(record.accountId, record.userId);
  await RedisUtils.addToSet(indexKey, key);
  await RedisUtils.expire(indexKey, ttlSeconds);
};

const removeFromUserSessionIndex = async (record: TokenSessionRecord | null, key: string): Promise<void> => {
  if (!record?.accountId || !record.userId) {
    return;
  }

  await RedisUtils.removeFromSet(userSessionsKey(record.accountId, record.userId), key);
};

export const tokenSessionStore = {
  accessKey,
  refreshKey,
  userSessionsKey,

  async getAccessSession(token: string): Promise<TokenSessionRecord | null> {
    if (!token || !canUseSessionStore()) {
      return null;
    }

    const key = accessKey(token);
    const record = await RedisUtils.get<TokenSessionRecord>(key);
    if (!record) {
      return null;
    }

    if (isExpired(record)) {
      await RedisUtils.delete(key);
      await removeFromUserSessionIndex(record, key);
      return null;
    }

    return normalizeRecord(record);
  },

  async setAccessSession(input: SetAccessSessionInput): Promise<void> {
    if (!input.token || input.ttlSeconds <= 0 || !canUseSessionStore()) {
      return;
    }

    const key = accessKey(input.token);
    const record = normalizeRecord({
      tokenId: input.tokenId,
      userId: input.userId,
      accountId: input.accountId,
      principalType: 'user',
      expiresAt: input.expiresAt,
      isExternal: input.isExternal,
      isInternal: input.isInternal
    });

    await RedisUtils.set(key, record, input.ttlSeconds);
    await addToUserSessionIndex(record, key, input.ttlSeconds);
  },

  async deleteAccessSession(token: string): Promise<void> {
    if (!token || !canUseSessionStore()) {
      return;
    }

    const key = accessKey(token);
    const record = await RedisUtils.get<TokenSessionRecord>(key);
    await RedisUtils.delete(key);
    await removeFromUserSessionIndex(record, key);
  },

  async getRefreshSession(tokenHash: string): Promise<TokenSessionRecord | null> {
    if (!tokenHash || !canUseSessionStore()) {
      return null;
    }

    const key = refreshKey(tokenHash);
    const record = await RedisUtils.get<TokenSessionRecord>(key);
    if (!record) {
      return null;
    }

    if (isExpired(record)) {
      await RedisUtils.delete(key);
      await removeFromUserSessionIndex(record, key);
      return null;
    }

    return normalizeRecord(record);
  },

  async setRefreshSession(input: SetRefreshSessionInput): Promise<void> {
    if (!input.tokenHash || input.ttlSeconds <= 0 || !canUseSessionStore()) {
      return;
    }

    const key = refreshKey(input.tokenHash);
    const record = normalizeRecord({
      tokenId: input.tokenId,
      userId: input.userId,
      accountId: input.accountId,
      principalType: 'refresh_token',
      expiresAt: input.expiresAt,
      userAgent: input.userAgent,
      ipAddress: input.ipAddress
    });

    await RedisUtils.set(key, record, input.ttlSeconds);
    await addToUserSessionIndex(record, key, input.ttlSeconds);
  },

  async deleteRefreshSession(tokenHash: string): Promise<void> {
    if (!tokenHash || !canUseSessionStore()) {
      return;
    }

    const key = refreshKey(tokenHash);
    const record = await RedisUtils.get<TokenSessionRecord>(key);
    await RedisUtils.delete(key);
    await removeFromUserSessionIndex(record, key);
  },

  async deleteUserSessions(accountId: string, userId: string): Promise<void> {
    if (!accountId || !userId || !canUseSessionStore()) {
      return;
    }

    const indexKey = userSessionsKey(accountId, userId);
    const sessionKeys = await RedisUtils.getSet<string>(indexKey);
    await RedisUtils.deleteMany(sessionKeys);
    await RedisUtils.delete(indexKey);
  }
};

