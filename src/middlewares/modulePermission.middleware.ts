import { Request, Response, NextFunction } from 'express';
import { get } from 'lodash';
import { accountFeatureService } from '../masters/company/accountFeature.service';

/**
 * Middleware to check if a specific module/feature is enabled for the account.
 * Rejects with HTTP 403 if the module is disabled at the account level.
 */
export const checkModuleAccess = (moduleKey: string, action: string = 'view') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // 1. First check in-memory effective roleMenu if request is authenticated
      const roleMenu: any = get(req, 'roleMenu', null);
      if (roleMenu && roleMenu[moduleKey]) {
        if (roleMenu[moduleKey][action] === true) {
          return next();
        } else {
          return res.status(403).json({
            status: false,
            code: 'MODULE_DISABLED',
            message: `Module '${moduleKey}' is disabled for this account.`
          });
        }
      }

      // 2. Fallback check via accountFeatureService
      const accountId = (req.headers['x-account-id'] as string) || (req as any).user?.account_id || (req as any).accountId;
      if (accountId) {
        const isEnabled = await accountFeatureService.isModuleEnabledForAccount(accountId, moduleKey);
        if (!isEnabled) {
          return res.status(403).json({
            status: false,
            code: 'MODULE_DISABLED',
            message: `Module '${moduleKey}' is disabled for this account.`
          });
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
