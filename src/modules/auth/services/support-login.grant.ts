import mongoose from 'mongoose';

export const SUPPORT_LOGIN_GRANT_TTL_SECONDS = 60;

export const buildSupportLoginGrant = (email: string, companyId: string) => ({
  email: String(email || '').trim().toLowerCase(),
  org_id: String(companyId || '').trim(),
  supportGrant: true,
  isExternal: true,
  isInternal: true
});

export const buildSupportLoginConsumeFilter = (token: string, companyId: string, now: Date = new Date()) => ({
  _id: token,
  tokenType: 'access' as const,
  principalType: 'user',
  account_id: new mongoose.Types.ObjectId(String(companyId || '').trim()),
  isExternal: true,
  isInternal: true,
  expiresAt: { $gt: now }
});
