import assert from 'node:assert/strict';
import test from 'node:test';
import { generateAccessToken, authenticateTokenContext } from '../../_config/auth';
import { tokenSessionStore } from '../../_cache/session/tokenSessionStore';
import { TokenBlacklist } from '../../_cache/auth/tokenBlacklist';
import { usersService } from '../../masters/user/user.service';
import { companyService } from '../../masters/company/company.service';
import { rolesService } from '../../masters/user/role/roles.service';
import jwt from 'jsonwebtoken';
import { TokenModel } from '../../models/userToken.model';
import { UserModel } from '../../models/user.model';
import { refreshTokenService } from './refreshToken.service';
import { accountFeatureService } from '../../masters/company/accountFeature.service';
import { userAuthentication, userAuthenticationToken } from './authentication.service';
import { passwordService } from '../../utils/bcrypt';
import { analysisFeatureService } from '../../masters/analysisFeature/analysisFeature.service';
import { accountAccessService } from '../../_role/accountAccess.service';
import { refreshToken as refreshConfig } from '../../configDB';

test('deleted persistent sessions cannot be resurrected by a stale cache', async t => {
  const id = '64a000000000000000000001';
  const companyID = '64a000000000000000000002';
  const token = generateAccessToken({ id, companyID, username: 'test' });
  t.mock.method(TokenModel, 'exists', (() => ({ read: async () => null })) as any);
  t.mock.method(tokenSessionStore, 'deleteAccessSession', async () => {});
  t.mock.method(TokenBlacklist, 'isBlacklisted', async () => false);
  t.mock.method(tokenSessionStore, 'getAccessSession', async () => ({ userId: id, accountId: companyID, principalType: 'user', expiresAt: new Date(Date.now() + 60000).toISOString() }));
  t.mock.method(companyService, 'verifyCompany', async () => ({} as any));
  t.mock.method(usersService, 'verifyUserLogin', async () => ({ passwordExpiredAt: new Date() } as any));
  let rolesRead = false;
  t.mock.method(rolesService, 'verifyUserRole', async () => { rolesRead = true; return null; });
  await assert.rejects(authenticateTokenContext(token, companyID), (error: any) => error.status === 401);
  assert.equal(rolesRead, false);
});

test('refresh-issued access and rotated refresh records retain original authentication time', async t => {
  const original = new Date(Date.now() - 60_000);
  const user: any = { _id: '64a000000000000000000001', account_id: '64a000000000000000000002', username: 'test' };
  user.password = 'current-hash';
  t.mock.method(UserModel, 'exists', (() => ({ read: async () => ({ _id: user._id }) })) as any);
  const saved: any[] = [];
  t.mock.method(TokenModel.prototype, 'save', async function(this: any) { saved.push(this.toObject()); return this; });
  t.mock.method(tokenSessionStore, 'setAccessSession', async () => {});
  t.mock.method(tokenSessionStore, 'setRefreshSession', async () => {});
  t.mock.method(accountFeatureService, 'isCookieEnabledForAccount', async () => false);
  const access = await refreshTokenService.createAccessSession(user, {}, original);
  assert.equal((jwt.decode(access.token) as any).sessionStartedAt, original.getTime());
  await refreshTokenService.issueForUser({ headers: {}, socket: {} } as any, { clearCookie() {} } as any, user, access.token_id, original);
  const refresh = saved.find(record => record.tokenType === 'refresh');
  assert.equal(refresh.created.getTime(), original.getTime());
  // A late minted access token is still rejected by the current password timestamp.
  t.mock.method(TokenBlacklist, 'isBlacklisted', async () => false);
  t.mock.method(tokenSessionStore, 'getAccessSession', async () => ({ userId: user._id, accountId: user.account_id, principalType: 'user', expiresAt: new Date(Date.now() + 60000).toISOString() }));
  t.mock.method(companyService, 'verifyCompany', async () => ({} as any));
  t.mock.method(usersService, 'verifyUserLogin', async () => ({ passwordExpiredAt: new Date(original.getTime() + 1) } as any));
  t.mock.method(TokenModel, 'exists', (() => ({ read: async () => null })) as any);
  t.mock.method(tokenSessionStore, 'deleteAccessSession', async () => {});
  await assert.rejects(authenticateTokenContext(access.token, user.account_id), (error: any) => error.status === 401);
});

for (const authenticate of [userAuthentication, userAuthenticationToken]) {
  test(`${authenticate.name} stamps sessions before credential lookup, so a concurrent reset cannot resurrect login`, async t => {
    let clock = Date.now();
    const started = clock;
    t.mock.method(Date, 'now', () => clock);
    const user: any = { _id: '64a000000000000000000001', account_id: '64a000000000000000000002', username: 'test', password: 'old-hash', user_role: 'admin', isVerified: true, passwordExpiredAt: new Date('2020-01-01') };
    user.toObject = () => ({ ...user });
    t.mock.method(UserModel, 'findOne', ((filter: any) => filter.isFirstUser ? Promise.resolve(user) : { select: async () => user }) as any);
    t.mock.method(companyService, 'getAllCompanies', async () => ([{ cookie_status: 'disabled' }] as any));
    t.mock.method(passwordService, 'comparePassword', async () => { clock += 1000; return true; });
    t.mock.method(rolesService, 'verifyUserRole', async () => ({} as any));
    t.mock.method(TokenModel.prototype, 'save', async function(this: any) {
      assert.equal((jwt.decode(String(this._id)) as any).sessionStartedAt, started);
      return this;
    });
    t.mock.method(tokenSessionStore, 'setAccessSession', async () => {});
    t.mock.method(refreshTokenService, 'issueForUser', async (_req: any, _res: any, _user: any, _id: any, timestamp?: Date) => {
      assert.equal(timestamp?.getTime(), started); return { issued: true };
    });
    t.mock.method(accountAccessService, 'getEffectivePermissions', () => ({} as any));
    t.mock.method(analysisFeatureService, 'getFeatureData', async () => null);
    let error: any;
    let response: any;
    const res: any = { clearCookie() {}, status() { return this; }, json(value: any) { response = value; } };
    await authenticate({ body: { username: 'test', password: 'old-password' }, headers: {} } as any, res, value => { error = value; });
    assert.equal(error, undefined);
    assert.equal(response.status, true);
    assert.equal(response.data.passwordExpired, true);
    assert.match(response.data.passwordExpiryMessage, /password.*too old/i);
    assert.equal(response.data.userDetails?.password, undefined);
  });
}

test('refresh racing a password change preserves the original epoch through actual rotation wiring', async t => {
  const original = new Date(Date.now() - 60_000);
  const user: any = { _id: '64a000000000000000000001', account_id: '64a000000000000000000002', username: 'test', user_role: 'admin', passwordExpiredAt: new Date(original.getTime() - 1) };
  const stored: any = { _id: 'stored-refresh', userId: user._id, account_id: user.account_id, created: original, expiresAt: new Date(Date.now() + 60_000), async save() {} };
  t.mock.method(TokenModel, 'findOneAndUpdate', (() => ({ exec: async () => stored })) as any);
  t.mock.method(TokenModel, 'findOne', (() => ({ exec: async () => stored })) as any);
  t.mock.method(UserModel, 'findOne', (() => ({ select: async () => ({ ...user }) })) as any);
  t.mock.method(tokenSessionStore, 'getRefreshSession', async () => null);
  t.mock.method(tokenSessionStore, 'setRefreshSession', async () => {});
  t.mock.method(tokenSessionStore, 'deleteRefreshSession', async () => {});
  t.mock.method(tokenSessionStore, 'setAccessSession', async () => {});
  t.mock.method(TokenModel.prototype, 'save', async function(this: any) { return this; });
  t.mock.method(accountFeatureService, 'isCookieEnabledForAccount', async () => false);
  let resetAt: Date | undefined;
  t.mock.method(TokenModel, 'exists', (() => ({ read: async () => ({ _id: stored._id }) })) as any);
  t.mock.method(companyService, 'getAllCompanies', async () => {
    // The refresh already read the pre-reset user; reset completes during this await.
    resetAt = new Date(); return [{}] as any;
  });
  t.mock.method(rolesService, 'verifyUserRole', async () => ({} as any));
  t.mock.method(accountAccessService, 'getEffectivePermissions', () => ({} as any));
  let rotated = false;
  t.mock.method(refreshTokenService, 'issueForUser', async (_req: any, _res: any, _user: any, _id: any, epoch?: Date) => {
    assert.equal(epoch?.getTime(), original.getTime()); rotated = true;
    return { issued: true, rawToken: 'replacement', tokenHash: 'replacement-hash' };
  });
  const result = await refreshTokenService.refreshAccessToken({ body: { refreshToken: 'original-token' }, headers: { 'x-cmms-refresh-request': 'true' } } as any, { clearCookie() {} } as any);
  assert.ok(resetAt);
  assert.equal(rotated, refreshConfig.rotate);
  assert.equal((jwt.decode(result.token) as any).sessionStartedAt, original.getTime());
  t.mock.method(TokenBlacklist, 'isBlacklisted', async () => false);
  t.mock.method(tokenSessionStore, 'getAccessSession', async () => ({ userId: user._id, accountId: user.account_id, principalType: 'user', expiresAt: new Date(Date.now() + 60000).toISOString() }));
  t.mock.method(companyService, 'verifyCompany', async () => ({} as any));
  t.mock.method(usersService, 'verifyUserLogin', async () => ({ ...user, passwordExpiredAt: resetAt }));
  t.mock.method(TokenModel, 'exists', (() => ({ read: async () => null })) as any);
  t.mock.method(tokenSessionStore, 'deleteAccessSession', async () => {});
  await assert.rejects(authenticateTokenContext(result.token, user.account_id), (error: any) => error.status === 401);
});

test('a future password expiry does not invalidate a valid access session', async t => {
  const id = '64a000000000000000000001';
  const companyID = '64a000000000000000000002';
  const token = generateAccessToken({ id, companyID, username: 'test' });
  t.mock.method(TokenBlacklist, 'isBlacklisted', async () => false);
  t.mock.method(tokenSessionStore, 'getAccessSession', async () => ({ userId: id, accountId: companyID, principalType: 'user', expiresAt: new Date(Date.now() + 60000).toISOString() }));
  t.mock.method(TokenModel, 'exists', ((filter: any) => {
    assert.equal(filter._id, token); assert.equal(filter.userId, id);
    return { read: async () => ({ _id: token }) };
  }) as any);
  t.mock.method(companyService, 'verifyCompany', async () => ({} as any));
  t.mock.method(usersService, 'verifyUserLogin', async () => ({ _id: id, passwordExpiredAt: new Date(Date.now() + 90 * 86400000) } as any));
  t.mock.method(rolesService, 'verifyUserRole', async () => ({ account_id: companyID } as any));
  t.mock.method(accountAccessService, 'getEffectivePermissions', () => ({} as any));
  t.mock.method(analysisFeatureService, 'getFeatureData', async () => null);
  assert.equal((await authenticateTokenContext(token, companyID)).userData._id, id);
});

test('a password change during session issuance revokes the late-issued sessions', async t => {
  const user: any = { _id: '64a000000000000000000001', account_id: '64a000000000000000000002', password: 'old-hash' };
  const tokenId = '64a000000000000000000003';
  t.mock.method(TokenModel.prototype, 'save', async function(this: any) { return this; });
  t.mock.method(tokenSessionStore, 'setRefreshSession', async () => {});
  t.mock.method(accountFeatureService, 'isCookieEnabledForAccount', async () => false);
  t.mock.method(UserModel, 'exists', ((filter: any) => {
    assert.equal(filter.password, 'old-hash'); return { read: async () => null };
  }) as any);
  let revoked = false;
  t.mock.method(TokenModel, 'deleteMany', (async (filter: any) => {
    assert.equal(String(filter.userId), user._id); assert.equal(String(filter.$or.find((item: any) => item.token_id)?.token_id), tokenId);
    revoked = true; return { deletedCount: 2 };
  }) as any);
  t.mock.method(tokenSessionStore, 'deleteUserSessions', async () => {});
  await assert.rejects(refreshTokenService.issueForUser({ headers: {}, socket: {} } as any, { clearCookie() {} } as any, user, tokenId as any), (error: any) => error.status === 401);
  assert.equal(revoked, true);
});

for (const { rotate, sourceExists, saveThrows } of [
  { rotate: true, sourceExists: true, saveThrows: false },
  { rotate: true, sourceExists: false, saveThrows: false },
  { rotate: false, sourceExists: true, saveThrows: false },
  { rotate: false, sourceExists: false, saveThrows: false },
  { rotate: true, sourceExists: false, saveThrows: true }
]) {
    test(`refresh rotation=${rotate}, sourceExists=${sourceExists}, sourceSaveFails=${saveThrows} validates original session and cleans failures`, async t => {
      const previous = refreshConfig.rotate;
      refreshConfig.rotate = rotate;
      t.after(() => { refreshConfig.rotate = previous; });
      const user: any = { _id: '64a000000000000000000001', account_id: '64a000000000000000000002', username: 'test', user_role: 'admin', password: 'new-hash', passwordExpiredAt: new Date(Date.now() + 90 * 86400000) };
      const stored: any = { _id: 'source-refresh', userId: user._id, account_id: user.account_id, created: new Date(Date.now() - 60000), expiresAt: new Date(Date.now() + 60000), async save() { if (saveThrows) throw new Error('Document not found'); } };
      t.mock.method(TokenModel, 'findOneAndUpdate', (() => ({ exec: async () => stored })) as any);
      t.mock.method(TokenModel, 'findOne', (() => ({ exec: async () => stored })) as any);
      t.mock.method(UserModel, 'findOne', (() => ({ select: async () => user })) as any);
      t.mock.method(UserModel, 'exists', ((filter: any) => {
        assert.equal(filter.password, 'new-hash'); return { read: async () => ({ _id: user._id }) };
      }) as any);
      t.mock.method(TokenModel, 'exists', (() => ({ read: async () => sourceExists ? { _id: stored._id } : null })) as any);
      t.mock.method(TokenModel.prototype, 'save', async function(this: any) { return this; });
      for (const method of ['setAccessSession', 'setRefreshSession', 'deleteRefreshSession', 'deleteUserSessions'] as const) t.mock.method(tokenSessionStore, method, async () => {});
      t.mock.method(tokenSessionStore, 'getRefreshSession', async () => null);
      t.mock.method(accountFeatureService, 'isCookieEnabledForAccount', async () => false);
      t.mock.method(companyService, 'getAllCompanies', async () => ([{}] as any));
      t.mock.method(rolesService, 'verifyUserRole', async () => ({} as any));
      t.mock.method(accountAccessService, 'getEffectivePermissions', () => ({} as any));
      let cleaned = false;
      t.mock.method(TokenModel, 'deleteMany', (async (filter: any) => {
        assert.equal(String(filter.userId), user._id); assert.equal(String(filter.account_id), user.account_id);
        assert.ok(filter.$or.some((entry: any) => entry.token_id)); cleaned = true; return { deletedCount: 2 };
      }) as any);
      const request = { body: { refreshToken: 'source-raw-token' }, headers: { 'x-cmms-refresh-request': 'true' }, socket: {} } as any;
      let cookiesCleared = 0;
      const response = { clearCookie() { cookiesCleared++; } } as any;
      if (sourceExists) {
        const result = await refreshTokenService.refreshAccessToken(request, response);
        assert.ok(result.token);
        assert.equal(result.userDetails.password, undefined);
        assert.equal(cleaned, false);
      } else {
        await assert.rejects(refreshTokenService.refreshAccessToken(request, response), (error: any) => error.status === 401);
        assert.equal(cleaned, true);
        assert.ok(cookiesCleared > 0);
      }
    });
}
