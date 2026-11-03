import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { emailLoginService, emailLoginDestination, EMAIL_LOGIN_TTL_SECONDS } from './email-login.service';
import { EmailLoginCredentialModel } from './email-login.model';
import { UserModel } from '../../users/models/user.model';
import { AccountModel } from '../../company/models/account.model';

const userId = '63a1492110c33e75c8232931';
const accountId = '63a1492110c33e75c8232932';
const keys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });

function setup(t: any) {
  const previous = { ...process.env };
  Object.assign(process.env, { EMAIL_LOGIN_ENABLED: 'true', EMAIL_LOGIN_PRIVATE_KEY: keys.privateKey,
    EMAIL_LOGIN_PUBLIC_KEYS: JSON.stringify({ test: keys.publicKey }), EMAIL_LOGIN_ACTIVE_KID: 'test',
    EMAIL_LOGIN_ISSUER: 'test-cmms', EMAIL_LOGIN_AUDIENCE: 'test-email', EMAIL_LOGIN_APP_URL: 'https://example.test/cmms' });
  process.env.LEGACY_EXTERNAL_AUTH_CUTOFF = '2030-01-01T00:00:00Z';
  t.after(() => { process.env = previous; });
  const state: any = { records: [], userActive: true, accountActive: true };
  t.mock.method(UserModel, 'findOne', (filter: any) => ({ lean: async () => state.userActive && filter._id === userId
    && filter.account_id === accountId ? { _id: userId, account_id: accountId, email: 'user@example.test', firstName: 'Test' } : null }));
  t.mock.method(AccountModel, 'findOne', () => ({ lean: async () => state.accountActive ? { _id: accountId } : null }));
  t.mock.method(EmailLoginCredentialModel, 'create', async (record: any) => { state.records.push(record); return record; });
  t.mock.method(EmailLoginCredentialModel, 'findOne', (filter: any) => ({ lean: async () => state.records.find((r: any) =>
    r.credentialId === filter.credentialId && r.tokenDigest === filter.tokenDigest && r.userId === filter.userId
    && r.accountId === filter.accountId && r.keyId === filter.keyId && !r.revokedAt
    && +r.issuedAt === +filter.issuedAt && +r.expiresAt === +filter.expiresAt) || null }));
  t.mock.method(EmailLoginCredentialModel, 'updateOne', async () => ({ matchedCount: 1 }));
  return state;
}
async function issue() {
  const result = await emailLoginService.createEmailLoginLink({ userId, accountId,
    destination: '/assets/analysis-details/asset-1?source=email#activity', mailCategory: 'alert', dispatchId: 'mail-1' });
  const token = new URLSearchParams(new URL(result.url).hash.slice(1)).get('token')!;
  return { ...result, token };
}

test('email credentials have a fixed seven-day lifetime and remain reusable with immutable destination', async t => {
  const state = setup(t);
  const result = await issue();
  const claims = jwt.decode(result.token) as jwt.JwtPayload;
  assert.equal(claims.exp! - claims.iat!, EMAIL_LOGIN_TTL_SECONDS);
  assert.equal(EMAIL_LOGIN_TTL_SECONDS, 604800);
  assert.equal(state.records[0].tokenDigest, crypto.createHash('sha256').update(result.token).digest('hex'));
  assert.equal(JSON.stringify(state.records).includes(result.token), false);
  for (let i = 0; i < 3; i++) {
    assert.equal((await emailLoginService.exchange(result.token)).redirectPath,
      '/assets/analysis-details/asset-1?source=email#activity');
  }
  assert.equal(+result.expiresAt, claims.exp! * 1000);
});

test('different emails issue independent credentials even in the same second', async t => {
  setup(t);
  const one = await issue(); const two = await issue();
  assert.notEqual(one.token, two.token);
  assert.notEqual(one.credentialId, two.credentialId);
});

test('expiry is enforced exactly at seven days even while registry row remains', async t => {
  const state = setup(t); const result = await issue();
  t.mock.method(Date, 'now', () => +result.expiresAt - 1);
  await emailLoginService.inspect(result.token);
  t.mock.method(Date, 'now', () => +result.expiresAt);
  await assert.rejects(emailLoginService.inspect(result.token), /invalid or expired/);
  assert.equal(state.records.length, 1);
});

test('revoked, missing, disabled and cross-tenant identities cannot redeem', async t => {
  const state = setup(t); const result = await issue();
  state.records[0].revokedAt = new Date();
  await assert.rejects(emailLoginService.inspect(result.token));
  delete state.records[0].revokedAt;
  state.userActive = false;
  await assert.rejects(emailLoginService.inspect(result.token));
  state.userActive = true; state.accountActive = false;
  await assert.rejects(emailLoginService.inspect(result.token));
  state.accountActive = true; state.records[0].accountId = userId;
  await assert.rejects(emailLoginService.inspect(result.token));
  state.records = [];
  await assert.rejects(emailLoginService.inspect(result.token));
});

test('tampering, wrong audience, purpose, algorithm and missing dates fail', async t => {
  setup(t); const result = await issue();
  await assert.rejects(emailLoginService.inspect(result.token.slice(0, -12) + 'tampered'));
  const original = jwt.decode(result.token) as any;
  for (const override of [{ aud: 'other' }, { purpose: 'support-login' }, { exp: undefined }, { iat: undefined }, { v: 2 }]) {
    const payload = { ...original, ...override };
    Object.keys(payload).forEach(key => { if (payload[key] === undefined) delete payload[key]; });
    const altered = jwt.sign(payload, keys.privateKey, { algorithm: 'RS256', keyid: 'test', noTimestamp: !('iat' in payload) });
    await assert.rejects(emailLoginService.inspect(altered));
  }
  await assert.rejects(emailLoginService.inspect(jwt.sign(original, 'attacker-secret', { algorithm: 'HS256', keyid: 'test' })));
});

test('feature off prevents issuance and exchange and database errors fail closed', async t => {
  setup(t); const result = await issue();
  process.env.EMAIL_LOGIN_ENABLED = 'false';
  await assert.rejects(issue(), /unavailable/);
  await assert.rejects(emailLoginService.inspect(result.token), /unavailable/);
  process.env.EMAIL_LOGIN_ENABLED = 'true';
  t.mock.method(EmailLoginCredentialModel, 'findOne', () => ({ lean: async () => { throw new Error('database unavailable'); } }));
  await assert.rejects(emailLoginService.exchange(result.token), /database unavailable/);
});

test('unsafe destinations and authentication loops are rejected', () => {
  for (const path of ['https://evil.test', '//evil.test', '/%2Fevil.test', '/a\\b', '/a%5Cb', '/login', '/external?token=x', '/redirect', '/email-login', '/a\nb']) {
    assert.throws(() => emailLoginDestination(path));
  }
  assert.equal(emailLoginDestination('/parts?label=%E6%B5%8B%E8%AF%95#stock'), '/parts?label=%E6%B5%8B%E8%AF%95#stock');
});

test('explicit revocation is scoped by account and never changes normal session tokens', async t => {
  setup(t);
  const queries: any[] = [];
  t.mock.method(EmailLoginCredentialModel, 'updateMany', async (filter: any, update: any) => {
    queries.push({ filter, update }); return { matchedCount: 1, modifiedCount: 1 };
  });
  await emailLoginService.revokeCredential('credential', accountId, userId);
  await emailLoginService.revokeUser(userId, accountId, userId, 'disabled');
  await emailLoginService.revokeAccount(accountId, userId);
  assert.equal(queries.length, 3);
  assert.deepEqual(queries[0].filter, { credentialId: 'credential', accountId, revokedAt: { $exists: false } });
  assert.deepEqual(queries[1].filter, { userId, accountId, revokedAt: { $exists: false } });
  assert.deepEqual(queries[2].filter, { accountId, revokedAt: { $exists: false } });
  assert.equal(queries[1].update.$set.revokeReason, 'disabled');
  assert.equal(queries[1].update.$set.revokedBy, userId);
});
