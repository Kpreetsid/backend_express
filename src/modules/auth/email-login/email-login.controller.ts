import { Request, Response } from 'express';
import { get } from 'lodash';
import { EmailLoginCredentialModel } from './email-login.model';
import { emailLoginService, emailLoginPageUrl } from './email-login.service';
import { establishExternalSession } from '../services/authentication.service';
import { isValidSupportServiceKey } from '../../../core/auth/support-login.middleware';
import { loginServiceKey } from '../../../core/config/env.config';

export const openEmailLoginPage = async (_req: Request, res: Response) => {
  res.setHeader('Referrer-Policy', 'no-referrer');
  // A redirect without a fragment lets the browser carry its existing fragment
  // to the app. Credentials are never accepted from query parameters here.
  return res.redirect(302, emailLoginPageUrl());
};

export const issueEmailLoginToken = async (req: Request, res: Response) => {
  const provided = req.headers['x-internal-service-key'];
  if (typeof provided !== 'string' || loginServiceKey.length < 32 || !isValidSupportServiceKey(provided, loginServiceKey)) {
    throw Object.assign(new Error('Unauthorized service'), { status: 401 });
  }
  return res.json({ status: true, data: await emailLoginService.issueEmailLoginLink(req.body) });
};

const identity = (req: Request) => {
  const user = get(req, 'user') as any;
  if (!user?._id || !user.account_id) {
    throw Object.assign(new Error('Unauthorized'), { status: 401 });
  }
  return {
    userId: String(user._id),
    accountId: String(user.account_id),
    admin: ['admin', 'super_admin'].includes(user.user_role)
  };
};

export const inspectEmailLogin = async (req: Request, res: Response) => {
  return res.json({ status: true, data: await emailLoginService.inspect(req.body?.token) });
};

export const exchangeEmailLogin = async (req: Request, res: Response) => {
  const { user, redirectPath } = await emailLoginService.exchange(req.body?.token);
  return establishExternalSession(req, res, (error: unknown) => { throw error; }, {
    email: user.email,
    org_id: String(user.account_id),
    isExternal: false,
    isInternal: true,
    redirectPath,
    userId: String(user._id)
  });
};

export const listEmailLoginCredentials = async (req: Request, res: Response) => {
  const actor = identity(req);
  const userId = typeof req.query.userId === 'string' ? req.query.userId : actor.userId;
  if (!actor.admin && userId !== actor.userId) {
    throw Object.assign(new Error('Forbidden'), { status: 403 });
  }
  const data = await EmailLoginCredentialModel.find({ accountId: actor.accountId, userId })
    .select('credentialId userId accountId mailCategory destination issuedAt expiresAt revokedAt revokeReason lastUsedAt useCount')
    .sort({ issuedAt: -1 })
    .limit(100)
    .lean();
  return res.json({ status: true, data });
};

export const revokeEmailLoginCredential = async (req: Request, res: Response) => {
  const actor = identity(req);
  const credentialId = typeof req.body?.credentialId === 'string' ? req.body.credentialId : '';
  const record = await EmailLoginCredentialModel.findOne({ credentialId, accountId: actor.accountId }).lean();
  if (!record || (!actor.admin && record.userId !== actor.userId)) {
    throw Object.assign(new Error('Not found'), { status: 404 });
  }
  await emailLoginService.revokeCredential(credentialId, actor.accountId, actor.userId);
  return res.json({ status: true });
};

export const revokeUserEmailLoginCredentials = async (req: Request, res: Response) => {
  const actor = identity(req);
  const userId = typeof req.body?.userId === 'string' ? req.body.userId : actor.userId;
  if (!actor.admin && actor.userId !== userId) {
    throw Object.assign(new Error('Forbidden'), { status: 403 });
  }
  await emailLoginService.revokeUser(userId, actor.accountId, actor.userId);
  return res.json({ status: true });
};
