import crypto from 'crypto';
import mongoose from 'mongoose';
import { ExternalLoginGrantModel, IExternalLoginGrant } from '@modules/auth/models/external-login-grant.model';
import { supportLogin } from '@core/config/env.config';

export const EXTERNAL_LOGIN_GRANT_TTL_SECONDS = 60;
export const EXTERNAL_LOGIN_ISSUER = 'internal-admin' as const;
export const EXTERNAL_LOGIN_AUDIENCE = 'cmms-web' as const;
export const EXTERNAL_LOGIN_PURPOSE = 'support.login' as const;

export const hashGrantSecret = (value: string): string =>
  crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');

export const createOpaqueGrantCode = (): string => crypto.randomBytes(32).toString('base64url');

export const resolveSupportEnvironment = (value: string | undefined): 'staging' | 'production' => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized !== 'staging' && normalized !== 'production') {
    throw Object.assign(new Error('Unsupported support-login environment'), { status: 400 });
  }
  const configured = String(supportLogin.environment || '').trim().toLowerCase();
  if ((configured === 'staging' || configured === 'production') && configured !== normalized) {
    throw Object.assign(new Error('Support-login environment mismatch'), { status: 403 });
  }
  return normalized;
};

export const buildGrantConsumeFilter = (
  code: string,
  stateProof: string,
  environment: 'staging' | 'production',
  now = new Date()
) => ({
  _id: hashGrantSecret(code),
  issuer: EXTERNAL_LOGIN_ISSUER,
  audience: EXTERNAL_LOGIN_AUDIENCE,
  environment,
  purpose: EXTERNAL_LOGIN_PURPOSE,
  stateHash: hashGrantSecret(stateProof),
  expiresAt: { $gt: now },
  consumedAt: { $exists: false }
});

export const issueExternalLoginGrant = async (input: {
  actorId: string;
  targetUserId: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  environment: 'staging' | 'production';
  stateChallenge: string;
}): Promise<{ code: string; expiresAt: Date }> => {
  if (!input.actorId || !input.stateChallenge || input.stateChallenge.length < 32) {
    throw Object.assign(new Error('Actor and browser state challenge are required'), { status: 400 });
  }
  const code = createOpaqueGrantCode();
  const expiresAt = new Date(Date.now() + EXTERNAL_LOGIN_GRANT_TTL_SECONDS * 1000);
  await ExternalLoginGrantModel.create({
    _id: hashGrantSecret(code),
    issuer: EXTERNAL_LOGIN_ISSUER,
    audience: EXTERNAL_LOGIN_AUDIENCE,
    environment: input.environment,
    companyId: input.companyId,
    actorId: input.actorId,
    targetUserId: input.targetUserId,
    purpose: EXTERNAL_LOGIN_PURPOSE,
    stateHash: hashGrantSecret(input.stateChallenge),
    expiresAt
  });
  return { code, expiresAt };
};

export const consumeExternalLoginGrant = async (
  code: string,
  stateProof: string,
  environment: 'staging' | 'production'
): Promise<IExternalLoginGrant | null> => {
  if (!code || !stateProof) return null;
  return ExternalLoginGrantModel.findOneAndUpdate(
    buildGrantConsumeFilter(code, stateProof, environment),
    { $set: { consumedAt: new Date() } },
    { new: true }
  ).exec();
};
