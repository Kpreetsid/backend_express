import { Types } from 'mongoose';
import { redisConfig, payloadCrypto } from '../../../core/config/env.config';
import { AccountModel } from '../models/account.model';
import { accountAccessService } from '../../users/services/account-access.service';

const ENABLED_STATUS = 'enabled';

interface AccountFeatureFlags {
  cookieEnabled: boolean;
  accountRoleMenu: Record<string, any>;
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
        accountRoleMenu: cached.accountRoleMenu
      };
    }

    try {
      const account = await AccountModel
        .findOne({ _id: accountId, visible: true, account_status: 'active' })
        .select('cookie_status account_role_menu experience_profile account_role_menu_profile')
        .lean<{
          cookie_status?: string;
          account_role_menu?: Record<string, any>;
          experience_profile?: string;
          account_role_menu_profile?: string;
        }>();

      const flags: AccountFeatureFlags = account
        ? {
          cookieEnabled: account.cookie_status === ENABLED_STATUS,
          accountRoleMenu: accountAccessService.getAccountRoleMenu(account)
        }
        : this.disabledFlags();

      this.statusCache.set(accountId, {
        ...flags,
        expiresAt: Date.now() + (redisConfig.statusTtlSeconds || 60) * 1000
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

  async isPayloadEncryptionEnabledForAccount(_accountId?: string): Promise<boolean> {
    return payloadCrypto.enabled && payloadCrypto.requestDecryptEnabled;
  }

  async isResponseEncryptionEnabledForAccount(_accountId?: string): Promise<boolean> {
    return payloadCrypto.enabled && payloadCrypto.responseEncryptEnabled;
  }

  async isModuleEnabledForAccount(accountId: string, moduleKey: string): Promise<boolean> {
    if (!moduleKey) return true;
    const flags = await this.getFeaturesForAccount(accountId);
    const roleMenu = flags.accountRoleMenu;
    if (!roleMenu || Object.keys(roleMenu).length === 0) {
      return true; // Default to open if no specific account role menu configured
    }
    return accountAccessService.isAccountPermissionEnabled(roleMenu, moduleKey, 'view');
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
      accountRoleMenu: {}
    };
  }
}

export const accountFeatureService = new AccountFeatureService();
