import { Request } from 'express';
import { redisConfig } from '../configDB';
import { SettingsModel } from '../models/settings.model';
import { isRedisReady } from '../_config/redis';

interface RedisStatusCacheEntry {
  enabled: boolean;
  expiresAt: number;
}

class RedisStatusService {
  private readonly statusCache = new Map<string, RedisStatusCacheEntry>();

  async isRedisEnabledForAccount(accountId: string): Promise<boolean> {
    if (!accountId) {
      return false;
    }

    const cached = this.statusCache.get(accountId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.enabled;
    }

    try {
      const settings = await SettingsModel
        .findOne({ account_id: accountId, visible: true })
        .select('redis_status')
        .lean<{ redis_status?: string }>();
      const enabled = settings?.redis_status === 'enabled';
      this.statusCache.set(accountId, {
        enabled,
        expiresAt: Date.now() + redisConfig.statusTtlSeconds * 1000
      });
      return enabled;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown settings lookup error';
      console.error('Redis status lookup failed, bypassing cache:', message);
      return false;
    }
  }

  clear(accountId?: string): void {
    if (accountId) {
      this.statusCache.delete(accountId);
      return;
    }
    this.statusCache.clear();
  }
}

export const redisStatusService = new RedisStatusService();

export const getRequestAccountId = (req: Request): string => {
  const requestData = req as any;
  return String(
    requestData.companyID
    || requestData.user?.account_id
    || req.headers.accountid
    || ''
  );
};

export const canUseRedisForRequest = async (req: Request): Promise<boolean> => {
  if (!redisConfig.enabled || !isRedisReady()) {
    return false;
  }

  const accountId = getRequestAccountId(req);
  if (!accountId) {
    return false;
  }

  return redisStatusService.isRedisEnabledForAccount(accountId);
};
