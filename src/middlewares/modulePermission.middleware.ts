import { AccountAction } from '../_role/accountAccess.service';
import { hasAccountFeature } from './permission';

/**
 * Middleware to check if a specific module/feature is enabled for the account.
 * Rejects with HTTP 403 if the module is disabled at the account level.
 */
export const checkModuleAccess = (moduleKey: string, action: string = 'view') =>
  hasAccountFeature(moduleKey, action as AccountAction);
