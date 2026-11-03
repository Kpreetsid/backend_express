import crypto from 'node:crypto';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { UserModel } from '../../users/models/user.model';
import { AccountModel } from '../../company/models/account.model';
import { EmailLoginCredentialModel } from './email-login.model';
import { auth, mailCredential } from '../../../core/config/env.config';

export const EMAIL_LOGIN_TTL_SECONDS = 604800;
const invalid = () => Object.assign(new Error('This login link is invalid or expired.'), { status: 410 });
const unavailable = (detail = 'Email login is unavailable.', code = 'EMAIL_LOGIN_UNAVAILABLE') =>
  Object.assign(new Error(detail), { status: 503, code });
const digest = (token: string) => crypto.createHash('sha256').update(token).digest('hex');
const validId = (value: unknown): value is string => typeof value === 'string' && /^[a-fA-F0-9]{24}$/.test(value);

export function emailLoginDestination(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2048 || !/^\/(?!\/)/.test(value)
    || /[\\\u0000-\u0020\u007f]/.test(value)) throw invalid();
  let decoded = value;
  for (let depth = 0; depth < 5; depth++) {
    let next: string;
    try { next = decodeURIComponent(decoded); } catch { throw invalid(); }
    if (!/^\/(?!\/)/.test(next) || /[\\\u0000-\u001f\u007f]/.test(next)) throw invalid();
    const pathname = new URL(next, 'https://cmms.invalid').pathname;
    // Angular outlet expressions can resolve to a different primary route.
    if (/[()]/.test(pathname)) throw invalid();
    if (/^\/(?:email-login|external|redirect|login|logout|register|reset-password|forgot-password)(?:[\/;]|$)/i.test(pathname)) throw invalid();
    if (next === decoded || !/%[a-f\d]{2}/i.test(next)) return value;
    decoded = next;
  }
  throw invalid();
}

export function emailLoginPageUrl(): string {
  const override = process.env.EMAIL_LOGIN_APP_URL?.trim();
  const appUrl = override || mailCredential.loginUrl?.trim();
  if (!appUrl) {
    throw unavailable('Email login is unavailable: configure EMAIL_LOGIN_APP_URL or MAIL_LOGIN_URL.', 'EMAIL_LOGIN_APP_URL_NOT_CONFIGURED');
  }
  let base: URL;
  try { base = new URL(appUrl); } catch {
    throw unavailable('Email login is unavailable: the configured app URL is invalid.', 'EMAIL_LOGIN_APP_URL_INVALID');
  }
  const localHttp = base.protocol === 'http:' && process.env.NODE_ENV !== 'production'
    && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
  if ((base.protocol !== 'https:' && !localHttp) || base.username || base.password || base.search || base.hash) {
    throw unavailable('Email login is unavailable: the configured app URL must use HTTPS, or loopback HTTP outside production, without credentials, query or fragment.', 'EMAIL_LOGIN_APP_URL_INVALID');
  }
  // Existing mail configuration may point to the sign-in page rather than its app root.
  if (!override) base.pathname = base.pathname.replace(/\/login\/?$/i, '/');
  return `${base.toString().replace(/\/$/, '')}/email-login`;
}

export interface CreateEmailLoginInput {
  userId: string;
  accountId: string;
  destination: string;
  mailCategory: string;
  dispatchId: string;
}

async function activeIdentity(userId: string, accountId: string) {
  if (!validId(userId) || !validId(accountId)) throw invalid();
  const user = await UserModel.findOne({ _id: userId, account_id: accountId, user_status: 'active' }).lean();
  const account = await AccountModel.findOne({ _id: accountId, account_status: 'active', visible: true }).lean();
  if (!user || !account) throw invalid();
  return user;
}

async function validate(token: unknown) {
  if (typeof token !== 'string' || token.length > 8192) throw invalid();
  if (typeof auth.secret !== 'string' || !auth.secret.trim()) throw unavailable();
  let claims: JwtPayload;
  try {
    const result = jwt.verify(token, auth.secret, {
      algorithms: ['HS256'],
      clockTimestamp: Math.floor(Date.now() / 1000), clockTolerance: 0
    });
    if (typeof result === 'string') throw invalid();
    claims = result;
  } catch { throw invalid(); }
  if (claims.v !== 1 || claims.purpose !== 'email-login' || !validId(claims.sub) || !validId(claims.account_id)
    || typeof claims.jti !== 'string' || !/^[a-f0-9]{64}$/.test(claims.jti)
    || !Number.isSafeInteger(claims.iat) || !Number.isSafeInteger(claims.exp)
    || claims.exp! - claims.iat! !== EMAIL_LOGIN_TTL_SECONDS || claims.iat! > Math.floor(Date.now() / 1000)) throw invalid();
  const record = await EmailLoginCredentialModel.findOne({ credentialId: claims.jti, tokenDigest: digest(token),
    userId: claims.sub, accountId: claims.account_id, revokedAt: { $exists: false },
    issuedAt: new Date(claims.iat! * 1000), expiresAt: new Date(claims.exp! * 1000) }).lean();
  if (!record || Date.now() >= record.expiresAt.getTime()) throw invalid();
  const user = await activeIdentity(claims.sub!, claims.account_id);
  return { record, user, redirectPath: emailLoginDestination(record.destination) };
}

export const emailLoginService = {
  async issueEmailLoginLink(input: unknown) {
    const badRequest = () => Object.assign(new Error('Valid userId, accountId and redirect are required'), { status: 400 });
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw badRequest();
    const { userId, accountId, redirect } = input as Record<string, unknown>;
    if (!validId(userId) || !validId(accountId)) throw badRequest();
    let destination: string;
    try { destination = emailLoginDestination(redirect); } catch { throw badRequest(); }
    return emailLoginService.createEmailLoginLink({ userId, accountId, destination,
      dispatchId: crypto.randomUUID(), mailCategory: 'internal-email-login' });
  },
  async createEmailLoginLink(input: CreateEmailLoginInput) {
    if (typeof auth.secret !== 'string' || !auth.secret.trim()) {
      throw unavailable('Email login is unavailable: AUTH_SECRET is not configured.', 'AUTH_SECRET_NOT_CONFIGURED');
    }
    const destination = emailLoginDestination(input.destination);
    await activeIdentity(input.userId, input.accountId);
    if (!input.dispatchId || !input.mailCategory) throw invalid();
    const pageUrl = emailLoginPageUrl();
    const now = Math.floor(Date.now() / 1000);
    const credentialId = crypto.randomBytes(32).toString('hex');
    let token: string;
    try {
      token = jwt.sign({ v: 1, purpose: 'email-login', sub: input.userId, account_id: input.accountId,
        jti: credentialId, iat: now, exp: now + EMAIL_LOGIN_TTL_SECONDS }, auth.secret,
        { algorithm: 'HS256' });
    } catch { throw unavailable(); }
    const expiresAt = new Date((now + EMAIL_LOGIN_TTL_SECONDS) * 1000);
    await EmailLoginCredentialModel.create({ credentialId, userId: input.userId, accountId: input.accountId,
      dispatchId: input.dispatchId, mailCategory: input.mailCategory, tokenDigest: digest(token), destination,
      issuedAt: new Date(now * 1000), expiresAt, useCount: 0 });
    return { url: `${pageUrl}#token=${encodeURIComponent(token)}`,
      external_token: token, expiresAt, credentialId, redirectPath: destination };
  },
  async inspect(token: unknown) {
    const { record, user, redirectPath } = await validate(token);
    return { userId: String(user._id), accountId: String(user.account_id), firstName: user.firstName,
      lastName: user.lastName, email: user.email, expiresAt: record.expiresAt, redirectPath };
  },
  async exchange(token: unknown) {
    const result = await validate(token);
    // A concurrent revocation must prevent a fresh exchange as well.
    const update = await EmailLoginCredentialModel.updateOne({ credentialId: result.record.credentialId,
      revokedAt: { $exists: false }, expiresAt: { $gt: new Date() } },
    { $set: { lastUsedAt: new Date() }, $inc: { useCount: 1 } });
    if (update.matchedCount !== 1) throw invalid();
    return { user: result.user, redirectPath: result.redirectPath };
  },
  async revokeCredential(credentialId: string, accountId: string, actorId: string, reason = 'explicit') {
    return EmailLoginCredentialModel.updateMany({ credentialId, accountId, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date(), revokedBy: actorId, revokeReason: reason } });
  },
  async revokeUser(userId: string, accountId: string, actorId: string, reason = 'explicit') {
    return EmailLoginCredentialModel.updateMany({ userId, accountId, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date(), revokedBy: actorId, revokeReason: reason } });
  },
  async revokeAccount(accountId: string, actorId: string, reason = 'disabled') {
    return EmailLoginCredentialModel.updateMany({ accountId, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date(), revokedBy: actorId, revokeReason: reason } });
  }
};
