import { Request } from 'express';
import { redisConfig } from '../configDB';
import { isRedisReady } from '../_config/redis';

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
  if (!redisConfig.enabled) {
    return false;
  }

  if (!isRedisReady()) {
    return false;
  }

  return true;
};
