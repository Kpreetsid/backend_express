export const SUPPORT_LOGIN_GRANT_TTL_SECONDS = 60;

export const buildSupportLoginGrant = (email: string, companyId: string) => ({
  email: String(email || '').trim().toLowerCase(),
  org_id: String(companyId || '').trim(),
  supportGrant: true,
  isExternal: true,
  isInternal: true
});

export const buildSupportLoginConsumeFilter = (token: string, now: Date = new Date()) => ({
  _id: token,
  tokenType: 'access',
  principalType: 'user',
  isExternal: true,
  isInternal: true,
  expiresAt: { $gt: now }
});
