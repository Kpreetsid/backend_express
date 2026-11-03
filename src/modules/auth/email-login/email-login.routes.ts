import express, { Request, Response, NextFunction } from 'express';
import { get } from 'lodash';
import { isAuthenticated } from '../../../core/auth/auth.middleware';
import { rateLimiter } from '../../../common/middlewares/rate-limit.middleware';
import { EmailLoginCredentialModel } from './email-login.model';
import { emailLoginService } from './email-login.service';
import { establishExternalSession } from '../services/authentication.service';

const handler = (action: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store');
    Promise.resolve(action(req, res)).catch(next);
  };
const identity = (req: Request) => {
  const user = get(req, 'user') as any;
  if (!user?._id || !user.account_id) throw Object.assign(new Error('Unauthorized'), { status: 401 });
  return { userId: String(user._id), accountId: String(user.account_id), admin: ['admin', 'super_admin'].includes(user.user_role) };
};

export function registerEmailLoginRoutes(router: express.Router): void {
  const routes = express.Router();
  routes.post('/inspect', rateLimiter.authLimiter, handler(async (req, res) =>
    res.json({ status: true, data: await emailLoginService.inspect(req.body?.token) })));
  routes.post('/exchange', rateLimiter.authLimiter, handler(async (req, res) => {
    const { user, redirectPath } = await emailLoginService.exchange(req.body?.token);
    return establishExternalSession(req, res, (error: unknown) => { throw error; }, {
      email: user.email, org_id: String(user.account_id), isExternal: false, isInternal: true, redirectPath,
      userId: String(user._id)
    });
  }));
  routes.get('/credentials', isAuthenticated, handler(async (req, res) => {
    const actor = identity(req);
    const userId = typeof req.query.userId === 'string' ? req.query.userId : actor.userId;
    if (!actor.admin && userId !== actor.userId) throw Object.assign(new Error('Forbidden'), { status: 403 });
    const data = await EmailLoginCredentialModel.find({ accountId: actor.accountId, userId })
      .select('credentialId userId accountId mailCategory destination issuedAt expiresAt revokedAt revokeReason lastUsedAt useCount')
      .sort({ issuedAt: -1 }).limit(100).lean();
    return res.json({ status: true, data });
  }));
  routes.post('/revoke', isAuthenticated, handler(async (req, res) => {
    const actor = identity(req);
    const credentialId = typeof req.body?.credentialId === 'string' ? req.body.credentialId : '';
    const record = await EmailLoginCredentialModel.findOne({ credentialId, accountId: actor.accountId }).lean();
    if (!record || (!actor.admin && record.userId !== actor.userId)) throw Object.assign(new Error('Not found'), { status: 404 });
    await emailLoginService.revokeCredential(credentialId, actor.accountId, actor.userId);
    return res.json({ status: true });
  }));
  routes.post('/revoke-user', isAuthenticated, handler(async (req, res) => {
    const actor = identity(req);
    const userId = typeof req.body?.userId === 'string' ? req.body.userId : actor.userId;
    if (!actor.admin && actor.userId !== userId) throw Object.assign(new Error('Forbidden'), { status: 403 });
    await emailLoginService.revokeUser(userId, actor.accountId, actor.userId);
    return res.json({ status: true });
  }));
  router.use('/users/email-login', routes);
}
