import { ClientSession } from 'mongoose';
import { AccountModel } from '../models/account.model';
import { AssetModel } from '../../assets/models/asset.model';
import { LocationModel } from '../../locations/models/location.model';
import { UserModel } from '../../users/models/user.model';

export const SUBSCRIPTION_LIMIT_CODE = 'SUBSCRIPTION_LIMIT_REACHED';
export const SUBSCRIPTION_RESOURCES = ['user', 'location', 'asset'] as const;

export type SubscriptionResource = typeof SUBSCRIPTION_RESOURCES[number];

export interface SubscriptionLimitStatus {
  resource: SubscriptionResource;
  limit: number;
  current: number;
  remaining: number | null;
  unlimited: boolean;
  reached: boolean;
}

export interface SubscriptionLimitUsage {
  user: SubscriptionLimitStatus;
  location: SubscriptionLimitStatus;
  asset: SubscriptionLimitStatus;
}

const RESOURCE_CONFIG = {
  user: {
    limitField: 'user_limit',
    singular: 'user',
    plural: 'users',
    currentLabel: 'currently active',
    count: (accountId: any, session?: ClientSession) =>
      UserModel.countDocuments({ account_id: accountId, user_status: 'active' }).session(session || null)
  },
  location: {
    limitField: 'location_limit',
    singular: 'location',
    plural: 'locations',
    currentLabel: 'currently in use',
    count: (accountId: any, session?: ClientSession) =>
      LocationModel.countDocuments({ account_id: accountId, visible: true }).session(session || null)
  },
  asset: {
    limitField: 'asset_limit',
    singular: 'asset',
    plural: 'assets',
    currentLabel: 'currently in use',
    count: (accountId: any, session?: ClientSession) =>
      AssetModel.countDocuments({ account_id: accountId, visible: true }).session(session || null)
  }
} as const;

const normalizeLimit = (value: unknown): number => {
  const limit = Number(value);
  return Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 0;
};

const normalizeRequested = (value: unknown): number => {
  const requested = Number(value);
  return Number.isFinite(requested) && requested > 0 ? Math.ceil(requested) : 1;
};

export const buildSubscriptionLimitStatus = (
  resource: SubscriptionResource,
  limitValue: unknown,
  currentValue: unknown
): SubscriptionLimitStatus => {
  const limit = normalizeLimit(limitValue);
  const current = Math.max(0, Number(currentValue) || 0);
  const unlimited = limit === 0;
  return {
    resource,
    limit,
    current,
    remaining: unlimited ? null : Math.max(0, limit - current),
    unlimited,
    reached: !unlimited && current >= limit
  };
};

export const buildSubscriptionLimitMessage = (
  status: SubscriptionLimitStatus,
  requestedValue: unknown = 1
): string => {
  const requested = normalizeRequested(requestedValue);
  const config = RESOURCE_CONFIG[status.resource];
  const requestedLabel = requested === 1 ? `another ${config.singular}` : `${requested} ${config.plural}`;
  const currentVerb = status.current === 1 ? 'is' : 'are';
  return `Cannot add ${requestedLabel}. Your subscription limit is ${status.limit} ${config.plural}, and ${status.current} ${currentVerb} ${config.currentLabel}. Increase the limit in INTERNAL to continue.`;
};

class SubscriptionLimitService {
  private async getAccount(accountId: any, session?: ClientSession): Promise<any> {
    const account = await AccountModel.findById(accountId)
      .select('user_limit location_limit asset_limit')
      .session(session || null)
      .lean();
    if (!account) {
      throw Object.assign(new Error('Account not found'), { status: 404 });
    }
    return account;
  }

  async getUsage(accountId: any, session?: ClientSession): Promise<SubscriptionLimitUsage> {
    const account = await this.getAccount(accountId, session);

    const [userCount, locationCount, assetCount] = await Promise.all([
      RESOURCE_CONFIG.user.count(accountId, session),
      RESOURCE_CONFIG.location.count(accountId, session),
      RESOURCE_CONFIG.asset.count(accountId, session)
    ]);

    return {
      user: buildSubscriptionLimitStatus('user', account.user_limit, userCount),
      location: buildSubscriptionLimitStatus('location', account.location_limit, locationCount),
      asset: buildSubscriptionLimitStatus('asset', account.asset_limit, assetCount)
    };
  }

  async getStatus(
    accountId: any,
    resource: SubscriptionResource,
    session?: ClientSession
  ): Promise<SubscriptionLimitStatus> {
    const account = await this.getAccount(accountId, session);
    const config = RESOURCE_CONFIG[resource];
    const current = await config.count(accountId, session);
    return buildSubscriptionLimitStatus(resource, account[config.limitField], current);
  }

  async assertCanCreate(
    accountId: any,
    resource: SubscriptionResource,
    requestedValue: unknown = 1,
    session?: ClientSession
  ): Promise<SubscriptionLimitStatus> {
    const requested = normalizeRequested(requestedValue);
    const status = await this.getStatus(accountId, resource, session);
    if (status.unlimited || status.current + requested <= status.limit) {
      return status;
    }

    throw Object.assign(new Error(buildSubscriptionLimitMessage(status, requested)), {
      status: 403,
      code: SUBSCRIPTION_LIMIT_CODE,
      data: {
        ...status,
        requested
      }
    });
  }
}

export const subscriptionLimitService = new SubscriptionLimitService();
