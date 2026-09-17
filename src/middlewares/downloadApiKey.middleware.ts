import { Request, Response, NextFunction } from 'express';
import { AccountModel, IAccount } from '../models/account.model';

export interface AuthenticatedDownloadRequest extends Request {
  account?: IAccount;
}

/**
 * Middleware to authenticate requests using an account download API key.
 * Checks 'x-api-key' header or 'apiKey' / 'api_key' query parameter.
 */
export const verifyDownloadApiKey = async (req: AuthenticatedDownloadRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    const rawApiKey = (req.headers['x-api-key'] || req.query.apiKey || req.query.api_key) as string | undefined;
    const apiKey = String(rawApiKey || '').trim();

    if (!apiKey) {
      throw Object.assign(new Error('Download API key is required'), { status: 401 });
    }

    const account = await AccountModel.findOne({
      download_api_key: apiKey,
      visible: true,
      account_status: 'active'
    });

    if (!account) {
      throw Object.assign(new Error('Invalid or inactive Download API key'), { status: 401 });
    }

    req.account = account;
    next();
  } catch (error) {
    next(error);
  }
};
