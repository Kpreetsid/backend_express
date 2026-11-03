import crypto from 'crypto';
import { UserModel } from '../../models/user.model';
import { AccountModel } from '../../models/account.model';
import { loginServiceKey } from '../../configDB';
import { SupportLoginCredential, SUPPORT_LOGIN_TTL_MS } from './support-login.model';
import type { SupportLoginInput } from './support-login.model';

// Preserve existing imports while the model module owns persistence definitions.
export { SupportLoginCredential, SUPPORT_LOGIN_TTL_MS } from './support-login.model';
export type { SupportLoginInput } from './support-login.model';

const digest = (token: string): string => crypto.createHash('sha256').update(token).digest('hex');

const denied = () => Object.assign(new Error('Invalid or expired support login link'), { status: 401 });

export const supportServiceAuthorized = (key: unknown, expected = loginServiceKey): boolean => {
  if (typeof key !== 'string' || !expected || expected.length < 32) return false;
  const a = Buffer.from(key), b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

export const consumeSupportLoginToken = async (token: unknown) => {
  if (typeof token !== 'string' || token.length !== 47 || !/^spt_[A-Za-z0-9_-]{43}$/.test(token)) throw denied();
  // Atomic consumption prevents concurrent redemption of a single-use credential.
  const credential = await SupportLoginCredential.findOneAndUpdate({
    digest: digest(token), consumedAt: { $exists: false }, expiresAt: { $gt: new Date() }
  }, { $set: { consumedAt: new Date() } }, { new: true });
  if (!credential) throw denied();
  const user = await UserModel.findOne({ _id: credential.userId, account_id: credential.accountId, user_status: 'active' });
  const account = await AccountModel.findOne({ _id: credential.accountId, account_status: 'active', visible: { $ne: false } });
  if (!user || !account) throw denied();
  console.info('support-login-redeemed', { credentialId: String(credential._id), actorId: credential.actorId, userId: String(credential.userId), accountId: String(credential.accountId) });
  return { userId: String(credential.userId), email: user.email, org_id: String(credential.accountId), isInternal: true, isExternal: false,
    redirectPath: '/dashboard', supportActor: { actorId: credential.actorId, reason: credential.reason, credentialId: String(credential._id) } };
};

const validId = (value: unknown): value is string => typeof value === 'string' && /^[a-fA-F0-9]{24}$/.test(value);

export const issueSupportLoginToken = async (input: unknown) => {
  try {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw Object.assign(new Error('1. Target identity and a support reason are required'), { status: 400 });
    }
    const { userId, accountId, actorId, reason } = input as Partial<SupportLoginInput>;
    console.info({ userId, accountId, actorId, reason });
    if (!validId(userId) || !validId(accountId) || !validId(actorId) || typeof reason !== 'string' || reason.trim().length < 5 || reason.length > 500) {
      throw Object.assign(new Error('2. Target identity and a support reason are required'), { status: 400 });
    }
    const user = await UserModel.findOne({ _id: userId, account_id: accountId, user_status: 'active' });
    const account = await AccountModel.findOne({ _id: accountId, account_status: 'active', visible: { $ne: false } });
    if (!user || !account) throw denied();
    const external_token = `spt_${crypto.randomBytes(32).toString('base64url')}`;
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + SUPPORT_LOGIN_TTL_MS);
    const row = await SupportLoginCredential.create({
      digest: digest(external_token), userId, accountId, actorId,
      reason: reason.trim(), issuedAt, expiresAt
    });
    // Metadata only: never log the credential or the reason's user-supplied text.
    console.info('support-login-issued', { credentialId: String(row._id), userId, accountId, actorId, external_token, expiresAt });
    return { external_token, expiresAt };
  } catch (error) {
    console.error('support-login-issued', { error });
    throw error;
  }
};
