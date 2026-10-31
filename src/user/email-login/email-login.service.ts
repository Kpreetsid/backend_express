import crypto from 'node:crypto';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { UserModel } from '../../models/user.model';
import { AccountModel } from '../../models/account.model';
import { EmailLoginCredentialModel } from './email-login.model';

export const EMAIL_LOGIN_TTL_SECONDS = 604800;
const invalid = () => Object.assign(new Error('This login link is invalid or expired.'), { status: 410 });
const unavailable = () => Object.assign(new Error('Email login is unavailable.'), { status: 503 });
const digest = (token: string) => crypto.createHash('sha256').update(token).digest('hex');
const validId = (value: unknown): value is string => typeof value === 'string' && /^[a-fA-F0-9]{24}$/.test(value);

export function emailLoginDestination(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2048 || !/^\/(?!\/)/.test(value)
    || /[\\\u0000-\u0020\u007f]/.test(value)) throw invalid();
  let decoded: string;
  try { decoded = decodeURIComponent(value); } catch { throw invalid(); }
  if (decoded.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(decoded)
    || /^\/(?:email-login|external|redirect|login|logout|register|reset-password|forgot-password)(?:[/?#;]|$)/i.test(decoded)) throw invalid();
  return value;
}

function configuration() {
  if (process.env.EMAIL_LOGIN_ENABLED !== 'true') throw unavailable();
  const issuer = process.env.EMAIL_LOGIN_ISSUER;
  const audience = process.env.EMAIL_LOGIN_AUDIENCE;
  const keyId = process.env.EMAIL_LOGIN_ACTIVE_KID;
  if (!issuer || !audience || !keyId) throw unavailable();
  // New issuance must not accidentally leave stateless legacy login enabled forever.
  const cutoff = process.env.LEGACY_EXTERNAL_AUTH_CUTOFF;
  if (!cutoff || !Number.isFinite(Date.parse(cutoff))) throw unavailable();
  let publicKeys: Record<string, string>;
  try { publicKeys = JSON.parse(process.env.EMAIL_LOGIN_PUBLIC_KEYS || '{}'); } catch { throw unavailable(); }
  if (!publicKeys || typeof publicKeys !== 'object') throw unavailable();
  return { issuer, audience, keyId, publicKeys };
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
  const config = configuration();
  let claims: JwtPayload;
  let keyId: string;
  try {
    const header = jwt.decode(token, { complete: true })?.header;
    if (!header || header.alg !== 'RS256' || typeof header.kid !== 'string'
      || !Object.prototype.hasOwnProperty.call(config.publicKeys, header.kid)) throw invalid();
    keyId = header.kid;
    const result = jwt.verify(token, config.publicKeys[keyId], {
      algorithms: ['RS256'], issuer: config.issuer, audience: config.audience,
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
    userId: claims.sub, accountId: claims.account_id, keyId, revokedAt: { $exists: false },
    issuedAt: new Date(claims.iat! * 1000), expiresAt: new Date(claims.exp! * 1000) }).lean();
  if (!record || Date.now() >= record.expiresAt.getTime()) throw invalid();
  const user = await activeIdentity(claims.sub!, claims.account_id);
  return { record, user, redirectPath: emailLoginDestination(record.destination) };
}

export const emailLoginService = {
  async createEmailLoginLink(input: CreateEmailLoginInput) {
    const config = configuration();
    const destination = emailLoginDestination(input.destination);
    await activeIdentity(input.userId, input.accountId);
    if (!input.dispatchId || !input.mailCategory) throw invalid();
    const privateKey = process.env.EMAIL_LOGIN_PRIVATE_KEY;
    if (!privateKey || !config.publicKeys[config.keyId]) throw unavailable();
    let base: URL;
    try { base = new URL(process.env.EMAIL_LOGIN_APP_URL || ''); } catch { throw unavailable(); }
    if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) throw unavailable();
    const now = Math.floor(Date.now() / 1000);
    const credentialId = crypto.randomBytes(32).toString('hex');
    const token = jwt.sign({ v: 1, purpose: 'email-login', sub: input.userId, account_id: input.accountId,
      jti: credentialId, iat: now, exp: now + EMAIL_LOGIN_TTL_SECONDS }, privateKey,
      { algorithm: 'RS256', keyid: config.keyId, issuer: config.issuer, audience: config.audience });
    // Catch a mismatched deployment key pair before delivering an unusable link.
    jwt.verify(token, config.publicKeys[config.keyId], { algorithms: ['RS256'], issuer: config.issuer, audience: config.audience });
    const expiresAt = new Date((now + EMAIL_LOGIN_TTL_SECONDS) * 1000);
    await EmailLoginCredentialModel.create({ credentialId, userId: input.userId, accountId: input.accountId,
      dispatchId: input.dispatchId, mailCategory: input.mailCategory, tokenDigest: digest(token), destination,
      issuedAt: new Date(now * 1000), expiresAt, keyId: config.keyId, useCount: 0 });
    return { url: `${base.toString().replace(/\/$/, '')}/email-login#token=${encodeURIComponent(token)}`, expiresAt, credentialId };
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
