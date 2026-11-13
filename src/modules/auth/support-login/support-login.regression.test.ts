import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { supportLoginRoutes } from './support-login.routes';
import { SupportLoginCredential } from './support-login.model';
import { consumeSupportLoginToken, supportServiceAuthorized } from './support-login.service';
import * as config from '../../../core/config/env.config';
import { UserModel } from '../../users/models/user.model';
import { AccountModel } from '../../company/models/account.model';
import { rateLimiter } from '../../../common/middlewares/rate-limit.middleware';
import { requestContextMiddleware } from '../../../common/middlewares/request-context.middleware';

const ids = { userId: '63a1492110c33e75c8232931', accountId: '63a1492110c33e75c8232932', actorId: '63a1492110c33e75c8232933' };
const raw = `spt_${'a'.repeat(43)}`;

test('support credential issuance rejects GET promptly and directs callers to POST', async t => {
  const app = express(); app.use('/tokens', supportLoginRoutes());
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.on('listening', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/tokens`, { signal: AbortSignal.timeout(1500) });
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'POST');
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('service key requires an exact dedicated secret of at least 32 characters', () => {
  for (const key of [undefined, [], '', 'short', 'b'.repeat(32)]) {
    assert.equal(supportServiceAuthorized(key, 'a'.repeat(32)), false);
  }
  assert.equal(supportServiceAuthorized('short', 'short'), false);
  assert.equal(supportServiceAuthorized('a'.repeat(32), 'a'.repeat(32)), true);
});

test('non-string and malformed credentials are denied before database access', async t => {
  const find = t.mock.method(SupportLoginCredential, 'findOneAndUpdate', async () => null);
  for (const token of [undefined, null, [], [raw], { toString: () => raw }, 'bad', `${raw}\n`]) {
    await assert.rejects(consumeSupportLoginToken(token as any), { status: 401 });
  }
  assert.equal(find.mock.callCount(), 0);
});

test('redemption atomically consumes a digest and retains current identity and provenance', async t => {
  let consumed = false;
  t.mock.method(SupportLoginCredential, 'findOneAndUpdate', async (query: any, update: any) => {
    assert.equal(query.digest, crypto.createHash('sha256').update(raw).digest('hex'));
    assert.deepEqual(query.consumedAt, { $exists: false });
    assert.ok(query.expiresAt.$gt instanceof Date);
    assert.ok(update.$set.consumedAt instanceof Date);
    if (consumed) return null;
    consumed = true;
    return { _id: 'credential', ...ids, reason: 'Support reason' };
  });
  t.mock.method(UserModel, 'findOne', (async (query: any) => {
    assert.deepEqual(query, { _id: ids.userId, account_id: ids.accountId, user_status: 'active' });
    return { email: 'current@example.test' };
  }) as any);
  t.mock.method(AccountModel, 'findOne', (async (query: any) => {
    assert.deepEqual(query, { _id: ids.accountId, account_status: 'active', visible: { $ne: false } });
    return {};
  }) as any);
  const results = await Promise.allSettled([consumeSupportLoginToken(raw), consumeSupportLoginToken(raw)]);
  const success = results.find(result => result.status === 'fulfilled');
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(success?.value.email, 'current@example.test');
  assert.deepEqual(success?.value.supportActor, { actorId: ids.actorId, reason: 'Support reason', credentialId: 'credential' });
});

test('redemption denies expired credentials and inactive target identities', async t => {
  const find = t.mock.method(SupportLoginCredential, 'findOneAndUpdate', async (): Promise<any> => null);
  await assert.rejects(consumeSupportLoginToken(raw), { status: 401 });
  find.mock.mockImplementation(async () => ({ _id: 'credential', ...ids }));
  const user = t.mock.method(UserModel, 'findOne', (async () => null) as any);
  t.mock.method(AccountModel, 'findOne', (async () => null) as any);
  await assert.rejects(consumeSupportLoginToken(raw), { status: 401 });
  user.mock.mockImplementation((async () => ({ email: 'current@example.test' })) as any);
  await assert.rejects(consumeSupportLoginToken(raw), { status: 401 });
});

test('issuance authenticates, validates, hashes the credential and forwards persistence errors', async t => {
  const logs = t.mock.method(console, 'info', () => {});
  t.mock.property(config, 'loginServiceKey', 'k'.repeat(32));
  t.mock.method(UserModel, 'findOne', (async () => ({ email: 'current@example.test' })) as any);
  t.mock.method(AccountModel, 'findOne', (async () => ({})) as any);
  let stored: any;
  const create = t.mock.method(SupportLoginCredential, 'create', (async (row: any) => { stored = row; return { _id: 'credential' }; }) as any);
  const app = express();
  app.use(requestContextMiddleware());
  app.use(express.json());
  app.use('/tokens', supportLoginRoutes());
  app.use((error: any, _req: any, res: any, _next: any) => res.status(error.status || 500).json({ status: false }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.on('listening', resolve));
  t.after(() => server.close());
  const request = (body: unknown, key = 'k'.repeat(32)) => fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/tokens`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-internal-service-key': key }, body: JSON.stringify(body)
  });
  const unauthorized = await request({ ...ids, reason: 'Support reason' }, 'wrong');
  assert.equal(unauthorized.status, 401);
  assert.ok(logs.mock.calls.some(call => call.arguments[0] === 'support-login-response'
    && (call.arguments[1] as any)?.correlationId === unauthorized.headers.get('x-correlation-id')
    && (call.arguments[1] as any)?.statusCode === 401));
  for (const body of [{}, { ...ids, actorId: [] }, { ...ids, userId: { $ne: null } }, { ...ids, userId: `${ids.userId}\n` }, { ...ids, reason: '    a   ' }, { ...ids, reason: 'a'.repeat(501) }]) {
    assert.equal((await request(body)).status, 400);
  }
  assert.equal(create.mock.callCount(), 0);
  const response = await request({ ...ids, reason: '  Support reason  ' });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const correlationId = response.headers.get('x-correlation-id');
  assert.ok(correlationId);
  const { data } = await response.json() as any;
  assert.match(data.external_token, /^spt_[A-Za-z0-9_-]{43}$/);
  assert.equal(stored.digest, crypto.createHash('sha256').update(data.external_token).digest('hex'));
  assert.equal(stored.reason, 'Support reason');
  assert.equal(stored.expiresAt.getTime() - stored.issuedAt.getTime(), 300000);
  const logged = JSON.stringify(logs.mock.calls.map(call => call.arguments));
  assert.equal(logged.includes(data.external_token), false, 'raw credentials must never be logged');
  assert.equal(logged.includes('Support reason'), false, 'support reasons must never be logged');
  assert.ok(logs.mock.calls.some(call => call.arguments[0] === 'support-login-response'
    && (call.arguments[1] as any)?.correlationId === correlationId
    && (call.arguments[1] as any)?.statusCode === 200));
  create.mock.mockImplementation((async () => { throw new Error('database unavailable'); }) as any);
  assert.equal((await request({ ...ids, reason: 'Support reason' })).status, 500);
});

test('throttled issuance responses remain uncacheable', async t => {
  t.mock.method(rateLimiter, 'authLimiter', (_req: any, res: any) => res.status(429).json({ status: false }));
  const app = express(); app.use('/tokens', supportLoginRoutes());
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.on('listening', resolve));
  t.after(() => server.close());
  const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/tokens`, { method: 'POST' });
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('support GET stays disabled and POST rejects missing keys without hanging', async t => {
  const app = express(); app.use(express.json()); app.use('/tokens', supportLoginRoutes());
  app.use((error: any, _req: any, res: any, _next: any) => res.status(error.status || 500).json({ status: false }));
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.on('listening', resolve)); t.after(() => server.close());
  for (const method of ['GET', 'POST']) {
    const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/tokens`, { method, signal: AbortSignal.timeout(1000) });
    assert.equal(response.status, method === 'GET' ? 405 : 401); assert.equal(response.headers.get('cache-control'), 'no-store');
  }
});
