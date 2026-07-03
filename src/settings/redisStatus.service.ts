import { Request } from 'express';
import { redisConfig } from '../configDB';
import { isRedisReady } from '../_config/redis';
import { accountFeatureService } from '../masters/company/accountFeature.service';

class RedisStatusService {
  async isRedisEnabledForAccount(accountId: string): Promise<boolean> {
    return accountFeatureService.isRedisEnabledForAccount(accountId);
  }

  clear(accountId?: string): void {
    accountFeatureService.clear(accountId);
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
