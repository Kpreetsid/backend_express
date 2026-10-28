import assert from 'node:assert/strict';
import test from 'node:test';
import { SUPPORT_LOGIN_GRANT_TTL_SECONDS, buildSupportLoginGrant, buildSupportLoginConsumeFilter } from './support-login.grant';

test('support login grant is company-bound and short lived', () => {
  assert.equal(SUPPORT_LOGIN_GRANT_TTL_SECONDS, 60);
  assert.deepEqual(buildSupportLoginGrant('user@example.com', '111111111111111111111111'), {
    email: 'user@example.com',
    org_id: '111111111111111111111111',
    supportGrant: true,
    isExternal: true,
    isInternal: true
  });
});

test('support login consume filter is one-use and expiry-bound', () => {
  const now = new Date('2026-10-28T09:00:00.000Z');
  const filter: any = buildSupportLoginConsumeFilter('grant-token', '111111111111111111111111', now);
  assert.equal(filter._id, 'grant-token');
  assert.equal(filter.tokenType, 'access');
  assert.equal(filter.principalType, 'user');
  assert.equal(String(filter.account_id), '111111111111111111111111');
  assert.equal(filter.isExternal, true);
  assert.equal(filter.isInternal, true);
  assert.equal(filter.expiresAt.$gt, now);
});
