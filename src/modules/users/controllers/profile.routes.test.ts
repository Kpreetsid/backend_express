import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';

// Keep the actual routers, profile controllers, sanitizer and cache wrapper real;
// replace unrelated administration handlers and external model/Redis operations.
function isolate(path: string, exports: unknown): void {
  const id = require.resolve(path);
  require.cache[id] = { id, filename: id, loaded: true, exports } as NodeModule;
}
const legacy: any = new Proxy({}, { get: () => (_req: express.Request, res: express.Response) => res.sendStatus(418) });
isolate('../controllers/user.controller', { userController: legacy });
isolate('../../company/controllers/company.controller', { companyController: legacy });
isolate('../routes/roles.routes', { default: () => undefined, __esModule: true });
isolate('../routes/logs.routes', { default: () => undefined, __esModule: true });
isolate('../../company/services/two-step-settings.controller', { getTwoStepSettings: legacy.get, updateTwoStepSettings: legacy.update });
isolate('../../../core/config/env.config', { redisConfig: { keyPrefix: 'profile-test', defaultTtlSeconds: 300 } });

const userId = '63a1492110c33e75c8232931';
const accountId = '63a1492110c33e75c8232932';
const updatedAt = '2026-11-12T10:30:00.000Z';
const phone = { number: '09876543210', internationalNumber: '+91 98765 43210', nationalNumber: '098765 43210',
  e164Number: '+919876543210', countryCode: 'IN', dialCode: '+91' };
const normalizedPhone = { ...phone };
const personal = { firstName: '  Jane  ', lastName: ' Doe ', phone_no: phone };
const account = { account_name: '  Example Company  ', description: '  Maintenance team  ' };
type Write = { kind: string; filter: any; update: any; options: any };
const writes: Write[] = [];
const deleted: string[] = [];
let result: 'saved' | 'missing' | 'duplicate' | 'failure' | 'validation' = 'saved';
let redisEnabled = true;
let principal: any = { _id: userId, account_id: accountId, user_role: 'employee' };
function model(kind: string) {
  return { findOneAndUpdate: async (filter: any, update: any, options: any) => {
    writes.push({ kind, filter, update, options });
    if (result === 'missing') return null;
    if (result === 'duplicate') throw Object.assign(new Error('sensitive duplicate details'), { code: 11000, name: 'MongoServerError' });
    if (result === 'failure') throw Error('sensitive database details');
    if (result === 'validation') throw Object.assign(Error('sensitive validation details'), { name: 'ValidationError' });
    return { _id: kind === 'user' ? userId : accountId, account_id: accountId,
      ...update.$set, password: 'must-not-leak', email: 'hidden@example.test', user_role: 'admin',
      cookie_status: 'enabled', account_role_menu: { hidden: true }, get: (field: string) => field === 'updatedAt' ? new Date(updatedAt) : undefined };
  } };
}
isolate('../models/user.model', { UserModel: model('user') });
isolate('../../company/models/account.model', { AccountModel: model('account'), COOKIES_ENUM: ['enabled', 'disabled'] });
isolate('../../settings/services/redis-status.service', {
  canUseRedisForRequest: async () => redisEnabled,
  getRequestAccountId: (req: any) => String(req.user?.account_id || '')
});
isolate('../../../core/cache/redis.utils', { RedisUtils: {
  getSet: async (key: string) => [`${key}:cached-read`],
  deleteMany: async (keys: string[]) => { deleted.push(...keys); },
  delete: async (key: string) => { deleted.push(key); }
} });
const registerUsers = require('../routes/user.routes').default;
const registerCompanies = require('../../company/routes/company.routes').default;
const { mongoSanitizeMiddleware } = require('../../../common/middlewares/mongo-sanitize.middleware');

test('dedicated profile HTTP contracts', async t => {
  const app = express();
  app.use(express.json());
  app.use(mongoSanitizeMiddleware());
  // Production /master isAuthenticated owns credential verification. Inject its
  // verified principal here; controllers must still fail closed if it is absent.
  app.use((req, _res, next) => { (req as any).user = principal; next(); });
  const router = express.Router(); registerUsers(router); registerCompanies(router);
  app.use('/api/master', router);
  app.use((error: any, _req: any, res: any, _next: any) =>
    res.status(error.status || 500).json({ status: false, message: error.message, error: error.message }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.on('listening', resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/master`;
  async function request(kind: 'users' | 'companies', body: unknown, raw = false) {
    writes.length = 0; deleted.length = 0;
    const response = await fetch(`${base}/${kind}/profile`, { method: 'PATCH',
      headers: { 'Content-Type': 'application/json' }, body: raw ? String(body) : JSON.stringify(body) });
    const json = await response.json() as any;
    await new Promise<void>(resolve => setImmediate(resolve));
    return { response, json };
  }
  t.beforeEach(() => {
    principal = { _id: userId, account_id: accountId, user_role: 'employee' };
    result = 'saved'; redisEnabled = true;
  });

  await t.test('literal user profile route saves only self fields and invalidates user tags', async () => {
    const { response, json } = await request('users', personal);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(json.data, { _id: userId, account_id: accountId, firstName: 'Jane', lastName: 'Doe', phone_no: normalizedPhone, updatedAt });
    assert.equal(json.status, true);
    assert.equal(typeof json.message, 'string');
    assert.deepEqual(writes[0], { kind: 'user', filter: { _id: userId, account_id: accountId, user_status: 'active', visible: { $ne: false } },
      update: { $set: { firstName: 'Jane', lastName: 'Doe', phone_no: normalizedPhone, updatedBy: userId } },
      options: { returnDocument: 'after', runValidators: true, timestamps: true, projection: { _id: 1, account_id: 1, firstName: 1, lastName: 1, phone_no: 1, updatedAt: 1 } } });
    assert.deepEqual(deleted.sort(), ['mappings', 'roles', 'users'].flatMap(tag => [
      `profile-test:tag:${accountId}:${tag}`, `profile-test:tag:${accountId}:${tag}:cached-read`]).sort());
  });
  await t.test('literal account route requires exact admin and atomically updates its own account', async () => {
    principal.user_role = 'admin';
    const { response, json } = await request('companies', account);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(json.data, { _id: accountId, account_name: 'Example Company', description: 'Maintenance team', updatedAt });
    assert.deepEqual(writes[0], { kind: 'account', filter: { _id: accountId, visible: { $ne: false }, account_status: { $ne: 'inactive' } },
      update: { $set: { account_name: 'Example Company', description: 'Maintenance team' } },
      options: { returnDocument: 'after', runValidators: true, timestamps: true, projection: { _id: 1, account_name: 1, description: 1, updatedAt: 1 } } });
    assert.deepEqual(deleted.sort(), ['companies', 'settings', 'users'].flatMap(tag => [
      `profile-test:tag:${accountId}:${tag}`, `profile-test:tag:${accountId}:${tag}:cached-read`]).sort());
  });
  for (const kind of ['users', 'companies'] as const) {
    for (const missing of [undefined, {}, { _id: userId }, { account_id: accountId },
      { _id: 'malformed', account_id: accountId }, { _id: userId, account_id: { $ne: null } }]) {
      await t.test(`${kind} rejects missing authenticated identity ${JSON.stringify(missing)}`, async () => {
        principal = missing;
        assert.equal((await request(kind, kind === 'users' ? personal : account)).response.status, 401);
        assert.equal(writes.length, 0); assert.equal(deleted.length, 0);
      });
    }
    for (const body of [null, [], 'text', 123, {}, '{broken']) {
      await t.test(`${kind} rejects malformed/empty body ${JSON.stringify(body)}`, async () => {
        principal.user_role = 'admin';
        assert.equal((await request(kind, body, body === '{broken')).response.status, 400);
        assert.equal(writes.length, 0); assert.equal(deleted.length, 0);
      });
    }
    for (const field of ['_id', 'id', 'account_id', 'email', 'username', 'password', 'user_role', 'type', 'account_status', 'two_step_auth_enabled', 'updatedAt', '$set', 'firstName.extra']) {
      await t.test(`${kind} rejects forged/unknown field ${field}, including pre-sanitization operators`, async () => {
        principal.user_role = 'admin';
        const body = { ...(kind === 'users' ? personal : account), [field]: { malicious: true } };
        assert.equal((await request(kind, body)).response.status, 400);
        assert.equal(writes.length, 0); assert.equal(deleted.length, 0);
      });
    }
    for (const value of [null, { polluted: true }]) {
      await t.test(`${kind} rejects own __proto__ even when sanitization consumes its setter`, async () => {
        principal.user_role = 'admin';
        const body = JSON.parse(JSON.stringify(kind === 'users' ? personal : account));
        Object.defineProperty(body, '__proto__', { enumerable: true, value });
        assert.equal((await request(kind, body)).response.status, 400);
        assert.equal(writes.length, 0);
      });
    }
    for (const outcome of ['missing', 'failure', 'validation'] as const) {
      await t.test(`${kind} maps ${outcome} without invalidation or raw errors`, async () => {
        principal.user_role = 'admin'; result = outcome;
        const { response, json } = await request(kind, kind === 'users' ? personal : account);
        assert.equal(response.status, outcome === 'missing' ? 404 : outcome === 'validation' ? 400 : 500);
        assert.doesNotMatch(JSON.stringify(json), /sensitive/);
        assert.equal(deleted.length, 0);
      });
    }
  }
  for (const role of ['manager', 'employee', 'customer', 'user', 'super-admin', undefined]) {
    await t.test(`account denies role ${role}`, async () => {
      principal.user_role = role;
      assert.equal((await request('companies', account)).response.status, 403);
      assert.equal(writes.length, 0);
    });
  }
  for (const [field, values] of Object.entries({ firstName: ['', ' ', 'J', 'J'.repeat(101), 5, {}, null], lastName: ['', ' ', 'D'.repeat(101), 5, [], null] })) {
    for (const value of values) await t.test(`user rejects invalid ${field} ${JSON.stringify(value)}`, async () => {
      assert.equal((await request('users', { ...personal, [field]: value })).response.status, 400);
      assert.equal(writes.length, 0);
    });
  }
  for (const value of [undefined, null, '+919876543210', [], {}, { ...phone, extra: 'hidden' },
    { ...phone, '$set': { countryCode: 'US' } }, { ...phone, 'number.extra': 'hidden' },
    { ...phone, e164Number: '919876543210' }, { ...phone, e164Number: '+0123456789' },
    { ...phone, e164Number: '+1234567890123456' }, { ...phone, dialCode: '+44' },
    { ...phone, countryCode: 'IND' }, { ...phone, internationalNumber: '+91 11111 11111' },
    { ...phone, nationalNumber: '1111111111' }, { ...phone, number: '1234567890' },
    { ...phone, number: '09876543210 ext 5' }]) {
    await t.test(`rejects invalid or inconsistent phone ${JSON.stringify(value)}`, async () => {
      assert.equal((await request('users', { ...personal, phone_no: value })).response.status, 400);
      assert.equal(writes.length, 0);
    });
  }
  await t.test('accepts formatted international/NANP phone and normalizes metadata whitespace/case', async () => {
    const usa = { number: ' +1 (202) 555-0123 ', internationalNumber: ' +1 202-555-0123 ', nationalNumber: '(202) 555-0123',
      e164Number: '+12025550123', countryCode: 'us', dialCode: '+1' };
    const { response, json } = await request('users', { ...personal, phone_no: usa });
    assert.equal(response.status, 200);
    assert.deepEqual(json.data.phone_no, { ...usa, number: '+1 (202) 555-0123', internationalNumber: '+1 202-555-0123', countryCode: 'US' });
  });
  for (const canonical of [
    { number: '+74951234567', internationalNumber: '+74951234567', nationalNumber: '4951234567', e164Number: '+74951234567', countryCode: 'RU', dialCode: '+7' },
    { number: '+3612345678', internationalNumber: '+3612345678', nationalNumber: '12345678', e164Number: '+3612345678', countryCode: 'HU', dialCode: '+36' },
    { number: '+5491123456789', internationalNumber: '+5491123456789', nationalNumber: '91123456789', e164Number: '+5491123456789', countryCode: 'AR', dialCode: '+54' }
  ]) {
    await t.test(`accepts canonical profile wire metadata independently of regional ${canonical.countryCode} trunk formatting`, async () => {
      const { response, json } = await request('users', { ...personal, phone_no: canonical });
      assert.equal(response.status, 200); assert.deepEqual(json.data.phone_no, canonical);
    });
  }
  for (const value of [null, { polluted: true }]) {
    await t.test('rejects nested phone __proto__ even when sanitizer consumes its setter', async () => {
      const body = JSON.parse(JSON.stringify(personal));
      Object.defineProperty(body.phone_no, '__proto__', { enumerable: true, value });
      assert.equal((await request('users', body)).response.status, 400);
      assert.equal(writes.length, 0);
    });
  }
  await t.test('sanitizer marker does not reject existing administrative routes', async () => {
    const response = await fetch(`${base}/users/${userId}`, { method: 'PATCH',
      headers: { 'Content-Type': 'application/json' }, body: '{"$set":{"firstName":"Other"},"__proto__":null}' });
    assert.equal(response.status, 418);
  });
  await t.test('user accepts documented name boundaries', async () => {
    const { response } = await request('users', { ...personal, firstName: 'J'.repeat(100), lastName: 'D'.repeat(100) });
    assert.equal(response.status, 200);
  });
  for (const body of [{ account_name: 'A' }, { account_name: ' ' }, { account_name: 'A'.repeat(151) }, { account_name: 5 },
    { account_name: 'Example', description: null }, { account_name: 'Example', description: {} },
    { account_name: 'Example', description: 'x'.repeat(2001) }]) {
    await t.test(`rejects invalid account values ${JSON.stringify(body).slice(0, 90)}`, async () => {
      principal.user_role = 'admin';
      assert.equal((await request('companies', body)).response.status, 400); assert.equal(writes.length, 0);
    });
  }
  await t.test('account description is optional and may be cleared as plain text', async () => {
    principal.user_role = 'admin';
    assert.equal((await request('companies', { account_name: 'AB' })).response.status, 200);
    assert.deepEqual(writes[0].update, { $set: { account_name: 'AB' } });
    const { response, json } = await request('companies', { account_name: 'A'.repeat(150), description: '  ' });
    assert.equal(response.status, 200); assert.equal(json.data.description, '');
    assert.equal((await request('companies', { account_name: 'AB', description: 'x'.repeat(2000) })).response.status, 200);
  });
  await t.test('duplicate account names produce 409 with a useful sanitized error', async () => {
    principal.user_role = 'admin'; result = 'duplicate';
    const { response, json } = await request('companies', account);
    assert.equal(response.status, 409); assert.match(json.message, /account name.*already|already.*account name/i);
    assert.doesNotMatch(JSON.stringify(json), /sensitive/); assert.equal(deleted.length, 0);
  });
  await t.test('disabled Redis still permits a successful save', async () => {
    redisEnabled = false;
    assert.equal((await request('users', personal)).response.status, 200);
    assert.equal(deleted.length, 0);
  });
  await t.test('each write remains bound to the current tenant even for admins', async () => {
    principal = { _id: '63a1492110c33e75c8232941', account_id: '63a1492110c33e75c8232942', user_role: 'admin' };
    result = 'missing';
    assert.equal((await request('users', personal)).response.status, 404);
    assert.equal(writes[0].filter._id, principal._id); assert.equal(writes[0].filter.account_id, principal.account_id);
    assert.equal((await request('companies', account)).response.status, 404);
    assert.equal(writes[0].filter._id, principal.account_id);
  });
});
