import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { emailLoginService, emailLoginDestination, EMAIL_LOGIN_TTL_SECONDS } from './email-login.service';
import { EmailLoginCredentialModel } from './email-login.model';
import { UserModel } from '../../models/user.model';
import { AccountModel } from '../../models/account.model';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { registerEmailLoginRoutes } from './email-login.routes';
import * as config from '../../configDB';

const userId = '63a1492110c33e75c8232931';
const accountId = '63a1492110c33e75c8232932';
const keys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
const destination = '/assets/analysis-details/69930de642182cf926ed292f?source=email#activity';

async function startIssuance(t: any) {
  const state = setup(t);
  t.mock.property(config, 'loginServiceKey', 'k'.repeat(32));
  const app = express(); app.use(express.json()); registerEmailLoginRoutes(app);
  app.use((error: any, _req: any, res: any, _next: any) => res.status(error.status || 500).json({ status: false, message: error.message }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.on('listening', resolve));
  t.after(() => server.close());
  const body = { userId, accountId, redirect: destination };
  const request = (input: unknown = body, key: string | null = 'k'.repeat(32)) => fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/internal/email-login-tokens`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(key === null ? {} : { 'x-internal-service-key': key }) }, body: JSON.stringify(input)
  });
  return { state, body, request };
}

test('internal issuance returns a mail URL whose reusable credential redirects to the saved destination', async t => {
  const { state, request } = await startIssuance(t);
  const response = await request();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const { data } = await response.json() as any;
  assert.equal(new URL(data.url).pathname, '/cmms/email-login');
  assert.equal(new URLSearchParams(new URL(data.url).hash.slice(1)).get('token'), data.external_token);
  assert.equal(data.redirectPath, destination);
  assert.equal('actorId' in state.records[0], false);
  assert.equal('reason' in state.records[0], false);
  assert.equal(state.records[0].mailCategory, 'internal-email-login');
  assert.ok(state.records[0].dispatchId);
  assert.equal(JSON.stringify(state.records).includes(data.external_token), false);
  assert.equal((await emailLoginService.inspect(data.external_token)).redirectPath, destination);
  for (let i = 0; i < 2; i++) assert.equal((await emailLoginService.exchange(data.external_token)).redirectPath, destination);
  state.records[0].revokedAt = new Date();
  await assert.rejects(emailLoginService.exchange(data.external_token), { status: 410 });
});

test('internal issuance authenticates before validation and rejects unsafe input without persistence', async t => {
  const { state, body, request } = await startIssuance(t);
  for (const key of [null, 'wrong']) {
    const response = await request({}, key);
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  for (const input of [[], {}, { ...body, userId: { $ne: null } }, { ...body, accountId: 'bad' }, { ...body, redirect: undefined },
    ...['https://evil.test', '//evil.test', '/%2Fevil.test', '/a\\b', '/a%5Cb', '/%zz', '/a/../login', '/%252F%252Fevil.test', '/(primary:email-login)', '/%28primary:login%29'].map(redirect => ({ ...body, redirect }))]) {
    const response = await request(input);
    assert.equal(response.status, 400, JSON.stringify(input));
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  assert.equal(state.records.length, 0);
});

test('internal issuance fails closed for configuration, identity and database failures', async t => {
  const { state, body, request } = await startIssuance(t);
  const secret = config.auth.secret;
  config.auth.secret = '';
  assert.equal((await request()).status, 503);
  config.auth.secret = secret;
  state.userActive = false;
  assert.equal((await request()).status, 410);
  state.userActive = true; state.accountActive = false;
  assert.equal((await request()).status, 410);
  state.accountActive = true;
  assert.equal((await request({ ...body, accountId: '63a1492110c33e75c8232999' })).status, 410);
  t.mock.method(EmailLoginCredentialModel, 'create', async () => { throw new Error('database unavailable'); });
  assert.equal((await request()).status, 500);
});

test('app base URLs preserve prefixes and permit HTTP only for loopback development', async t => {
  setup(t);
  for (const base of ['http://localhost:4200', 'http://127.0.0.1:4200/cmms/', 'http://[::1]:4200/cmms']) {
    process.env.NODE_ENV = 'development'; process.env.EMAIL_LOGIN_APP_URL = base;
    const result = await issue();
    assert.equal(new URL(result.url).pathname, `${new URL(base).pathname.replace(/\/$/, '')}/email-login`);
  }
  for (const [mode, base] of [['production', 'http://localhost:4200'], ['development', 'http://evil.test'], ['development', 'https://u:p@example.test'], ['development', 'https://example.test/?x=1']]) {
    process.env.NODE_ENV = mode; process.env.EMAIL_LOGIN_APP_URL = base;
    await assert.rejects(issue(), { status: 503 });
  }
});

test('missing app override uses the existing mail login URL and preserves its deployment prefix', async t => {
  setup(t);
  delete process.env.EMAIL_LOGIN_APP_URL;
  t.mock.property(config.mailCredential, 'loginUrl', 'https://example.test/cmms-staging');
  assert.equal(new URL((await issue()).url).pathname, '/cmms-staging/email-login');
  config.mailCredential.loginUrl = 'https://example.test/cmms/login/';
  assert.equal(new URL((await issue()).url).pathname, '/cmms/email-login');
  config.mailCredential.loginUrl = '';
  await assert.rejects(issue(), error => (error as any).status === 503 && /EMAIL_LOGIN_APP_URL.*MAIL_LOGIN_URL/.test((error as Error).message));
});

function setup(t: any) {
  const previous = { ...process.env };
  for (const name of ['EMAIL_LOGIN_ISSUER', 'EMAIL_LOGIN_AUDIENCE', 'EMAIL_LOGIN_ACTIVE_KID',
    'EMAIL_LOGIN_PRIVATE_KEY', 'EMAIL_LOGIN_PUBLIC_KEYS', 'LEGACY_EXTERNAL_AUTH_CUTOFF']) delete process.env[name];
  process.env.EMAIL_LOGIN_APP_URL = 'https://example.test/cmms';
  t.mock.property(config.auth, 'secret', 'existing-project-secret-for-email-tests');
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
  assert.equal(jwt.decode(result.token, { complete: true })?.header.alg, 'HS256');
  assert.equal((jwt.verify(result.token, config.auth.secret, { algorithms: ['HS256'] }) as jwt.JwtPayload).purpose, 'email-login');
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

test('a newly issued asset link uses its new destination without changing older links', async t => {
  setup(t);
  const oldPath = '/assets/analysis-details/69930de642182cf926ed292f';
  const newPath = '/assets/analysis-details/69aa7e0d6adf6d49b021f172';
  const oldLink = await emailLoginService.issueEmailLoginLink({ userId, accountId, redirect: oldPath });
  const newLink = await emailLoginService.issueEmailLoginLink({ userId, accountId, redirect: newPath });
  assert.notEqual(oldLink.external_token, newLink.external_token);
  assert.equal((await emailLoginService.inspect(oldLink.external_token)).redirectPath, oldPath);
  assert.equal((await emailLoginService.inspect(newLink.external_token)).redirectPath, newPath);
  assert.equal((await emailLoginService.exchange(newLink.external_token)).redirectPath, newPath);
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

test('tampering, changed claims, wrong purpose, algorithm and missing dates fail', async t => {
  setup(t); const result = await issue();
  await assert.rejects(emailLoginService.inspect(result.token.slice(0, -12) + 'tampered'));
  const original = jwt.decode(result.token) as any;
  for (const override of [{ aud: 'other' }, { purpose: 'support-login' }, { exp: undefined }, { iat: undefined }, { v: 2 }]) {
    const payload = { ...original, ...override };
    Object.keys(payload).forEach(key => { if (payload[key] === undefined) delete payload[key]; });
    const altered = jwt.sign(payload, config.auth.secret, { algorithm: 'HS256', noTimestamp: !('iat' in payload) });
    await assert.rejects(emailLoginService.inspect(altered));
  }
  await assert.rejects(emailLoginService.inspect(jwt.sign(original, 'attacker-secret', { algorithm: 'HS256', keyid: 'test' })));
  await assert.rejects(emailLoginService.inspect(jwt.sign(original, keys.privateKey, { algorithm: 'RS256' })));
});

test('missing project secret prevents issuance and exchange and database errors fail closed', async t => {
  setup(t); const result = await issue();
  const secret = config.auth.secret;
  config.auth.secret = '';
  await assert.rejects(issue(), /unavailable/);
  await assert.rejects(emailLoginService.inspect(result.token), /unavailable/);
  config.auth.secret = secret;
  t.mock.method(EmailLoginCredentialModel, 'findOne', () => ({ lean: async () => { throw new Error('database unavailable'); } }));
  await assert.rejects(emailLoginService.exchange(result.token), /database unavailable/);
});

test('unsafe destinations and authentication loops are rejected', () => {
  for (const path of ['https://evil.test', '//evil.test', '/%2Fevil.test', '/a\\b', '/a%5Cb', '/login', '/external?token=x', '/redirect', '/email-login', '/a\nb']) {
    assert.throws(() => emailLoginDestination(path));
  }
  assert.equal(emailLoginDestination('/parts?label=%E6%B5%8B%E8%AF%95#stock'), '/parts?label=%E6%B5%8B%E8%AF%95#stock');
  assert.equal(emailLoginDestination('/parts?label=Main%20Pump#stock'), '/parts?label=Main%20Pump#stock');
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
