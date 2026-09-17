import crypto from 'crypto';
import { AccountModel, IAccount } from '../../models/account.model';

/**
 * Retrieves the current download API key for the given account, or null if none exists.
 */
export const getAccountApiKeyService = async (account: IAccount): Promise<string | null> => {
  if (!account || !account._id) {
    throw Object.assign(new Error('Invalid Account'), { status: 400 });
  }
  return account.download_api_key || null;
};

/**
 * Generates and saves a new cryptographically secure download API key for the account.
 */
export const generateAccountApiKeyService = async (account: IAccount): Promise<string> => {
  if (!account || !account._id) {
    throw Object.assign(new Error('Invalid Account'), { status: 400 });
  }

  const accountApiKey = crypto.randomBytes(36).toString('base64url');
  await AccountModel.findByIdAndUpdate(
    account._id,
    { $set: { download_api_key: accountApiKey } },
    { returnDocument: 'after' }
  );
  account.download_api_key = accountApiKey;

  return accountApiKey;
};

/**
 * Removes/unsets the download API key for the account so it does not collide with sparse unique index.
 */
export const removeAccountApiKeyService = async (account: IAccount): Promise<boolean> => {
  if (!account || !account._id) {
    throw Object.assign(new Error('Invalid Account'), { status: 400 });
  }

  await AccountModel.findByIdAndUpdate(
    account._id,
    { $unset: { download_api_key: 1 } },
    { returnDocument: 'after' }
  );
  account.download_api_key = undefined;

  return true;
};