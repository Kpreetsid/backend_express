import { Types } from 'mongoose';
import { redisConfig } from '../../configDB';
import { AccountModel } from '../../models/account.model';

const ENABLED_STATUS = 'enabled';

interface AccountFeatureFlags {
  cookieEnabled: boolean;
  redisEnabled: boolean;
  payloadEncryptionEnabled: boolean;
  responseEncryptionEnabled: boolean;
}

interface AccountFeatureCacheEntry extends AccountFeatureFlags {
  expiresAt: number;
}

class AccountFeatureService {
  private readonly statusCache = new Map<string, AccountFeatureCacheEntry>();

  async getFeaturesForAccount(accountId: string): Promise<AccountFeatureFlags> {
    if (!accountId || !Types.ObjectId.isValid(accountId)) {
      return this.disabledFlags();
    }

    const cached = this.statusCache.get(accountId);
    if (cached && cached.expiresAt > Date.now()) {
      return {
        cookieEnabled: cached.cookieEnabled,
        redisEnabled: cached.redisEnabled,
        payloadEncryptionEnabled: cached.payloadEncryptionEnabled,
        responseEncryptionEnabled: cached.responseEncryptionEnabled
      };
    }

    try {
      const account = await AccountModel
        .findOne({ _id: accountId, visible: true, account_status: 'active' })
        .select('cookie_status redis_status encrypt_payload encrypt_response')
        .lean<{ cookie_status?: string; redis_status?: string; encrypt_payload?: string; encrypt_response?: string }>();

      const flags = account
        ? {
          cookieEnabled: account.cookie_status === ENABLED_STATUS,
          redisEnabled: account.redis_status === ENABLED_STATUS,
          payloadEncryptionEnabled: account.encrypt_payload === ENABLED_STATUS,
          responseEncryptionEnabled: account.encrypt_response === ENABLED_STATUS
        }
        : this.disabledFlags();

      this.statusCache.set(accountId, {
        ...flags,
        expiresAt: Date.now() + redisConfig.statusTtlSeconds * 1000
      });
      return flags;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown account feature lookup error';
      console.error('Account feature lookup failed, bypassing optional feature:', message);
      return this.disabledFlags();
    }
  }

  async isCookieEnabledForAccount(accountId: string): Promise<boolean> {
    const flags = await this.getFeaturesForAccount(accountId);
    return flags.cookieEnabled;
  }

  async isRedisEnabledForAccount(accountId: string): Promise<boolean> {
    const flags = await this.getFeaturesForAccount(accountId);
    return flags.redisEnabled;
  }

  async isPayloadEncryptionEnabledForAccount(accountId: string): Promise<boolean> {
    const flags = await this.getFeaturesForAccount(accountId);
    return flags.payloadEncryptionEnabled;
  }

  async isResponseEncryptionEnabledForAccount(accountId: string): Promise<boolean> {
    const flags = await this.getFeaturesForAccount(accountId);
    return flags.responseEncryptionEnabled;
  }

  clear(accountId?: string): void {
    if (accountId) {
      this.statusCache.delete(accountId);
      return;
    }
    this.statusCache.clear();
  }

  private disabledFlags(): AccountFeatureFlags {
    return {
      cookieEnabled: false,
      redisEnabled: false,
      payloadEncryptionEnabled: false,
      responseEncryptionEnabled: false
    };
  }
}

export const accountFeatureService = new AccountFeatureService();
