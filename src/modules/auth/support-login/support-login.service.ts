import crypto from 'crypto';
import { Router } from 'express';
import mongoose, { Schema } from 'mongoose';
import { UserModel } from '../../users/models/user.model';
import { AccountModel } from '../../company/models/account.model';
import { rateLimiter } from '../../../common/middlewares/rate-limit.middleware';

export const SUPPORT_LOGIN_TTL_MS = 5 * 60 * 1000;
const schema = new Schema({
  digest: { type: String, required: true, unique: true },
  userId: { type: Schema.Types.ObjectId, required: true },
  accountId: { type: Schema.Types.ObjectId, required: true },
  actorId: { type: String, required: true },
  reason: { type: String, required: true },
  issuedAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
  consumedAt: Date
}, { collection: 'support_login_credentials', versionKey: false });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const SupportLoginCredential = mongoose.models.SupportLoginCredential || mongoose.model('SupportLoginCredential', schema);
const digest = (token: string): string => crypto.createHash('sha256').update(token).digest('hex');
const denied = () => Object.assign(new Error('Invalid or expired support login link'), { status: 401 });

export const supportServiceAuthorized = (key: unknown, expected = process.env.INTERNAL_LOGIN_SERVICE_KEY): boolean => {
  if (typeof key !== 'string' || !expected || expected.length < 32) return false;
  const a = Buffer.from(key), b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

export const consumeSupportLoginToken = async (token: string): Promise<any> => {
  if (!/^spt_[A-Za-z0-9_-]{43}$/.test(token)) throw denied();
  // Atomic consumption prevents concurrent redemption of a single-use credential.
  const credential: any = await SupportLoginCredential.findOneAndUpdate({
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

export const supportLoginRoutes = (): Router => {
  const router = Router();
  router.post('/', rateLimiter.authLimiter, async (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      if (!supportServiceAuthorized(req.headers['x-internal-service-key'])) throw Object.assign(new Error('Unauthorized service'), { status: 401 });
      const { userId, accountId, actorId, reason } = req.body || {};
      if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(accountId) || !mongoose.isValidObjectId(actorId)
        || typeof reason !== 'string' || reason.trim().length < 5 || reason.length > 500) {
        throw Object.assign(new Error('Target identity and a support reason are required'), { status: 400 });
      }
      const user = await UserModel.findOne({ _id: userId, account_id: accountId, user_status: 'active' });
      const account = await AccountModel.findOne({ _id: accountId, account_status: 'active', visible: { $ne: false } });
      if (!user || !account) throw denied();
      const external_token = `spt_${crypto.randomBytes(32).toString('base64url')}`;
      const issuedAt = new Date(), expiresAt = new Date(issuedAt.getTime() + SUPPORT_LOGIN_TTL_MS);
      const row = await SupportLoginCredential.create({ digest: digest(external_token), userId, accountId, actorId, reason: reason.trim(), issuedAt, expiresAt });
      // Metadata only: never log the credential or the reason's user-supplied text.
      console.info('support-login-issued', { credentialId: String(row._id), userId, accountId, actorId });
      res.json({ status: true, data: { external_token, expiresAt } });
    } catch (error) { next(error); }
  });
  return router;
};
