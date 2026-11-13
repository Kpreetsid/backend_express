import test from 'node:test';
import assert from 'node:assert/strict';
import { AccountModel } from '../models/account.model';
import { getTwoStepSettings, updateTwoStepSettings } from './two-step-settings.controller';

test('two-step settings require account admin, validate input and retain tenant/policy revision scope', async t => {
  const previous = process.env.TWO_STEP_AUTH_SECRET;
  process.env.TWO_STEP_AUTH_SECRET = 's'.repeat(32);
  t.after(() => { if (previous === undefined) delete process.env.TWO_STEP_AUTH_SECRET; else process.env.TWO_STEP_AUTH_SECRET = previous; });
  const user = { _id: '63a1492110c33e75c8232931', account_id: '63a1492110c33e75c8232932', user_role: 'admin' };
  let scope: any; let mutation: any;
  const read = t.mock.method(AccountModel, 'findOne', (async (filter: any) => { scope = filter; return { two_step_auth_enabled: true }; }) as any);
  const write = t.mock.method(AccountModel, 'findOneAndUpdate', (async (filter: any, update: any) => {
    scope = filter; mutation = update; return { two_step_auth_enabled: true };
  }) as any);
  async function call(principal: any, body: any, action = updateTwoStepSettings) {
    let error: any; let payload: any;
    const res = { setHeader(name: string, value: string) { assert.equal(name, 'Cache-Control'); assert.equal(value, 'no-store'); },
      json(value: any) { payload = value; } };
    await action({ user: principal, body } as any, res as any, value => { error = value; });
    return { error, payload };
  }
  assert.equal((await call(undefined, { enabled: true })).error.status, 401);
  assert.equal((await call({ ...user, user_role: 'employee' }, { enabled: true })).error.status, 403);
  for (const body of [null, {}, { enabled: 'true' }, { enabled: true, account_id: 'other' }]) {
    assert.equal((await call(user, body)).error.status, 400);
  }
  assert.equal(write.mock.callCount(), 0);
  process.env.TWO_STEP_AUTH_SECRET = '';
  assert.equal((await call(user, { enabled: true })).error.status, 503);
  assert.equal(write.mock.callCount(), 0);
  process.env.TWO_STEP_AUTH_SECRET = 's'.repeat(32);
  assert.deepEqual((await call(user, { enabled: true })).payload.data, { enabled: true });
  assert.deepEqual(scope, { _id: user.account_id, visible: { $ne: false }, account_status: { $ne: 'inactive' }, two_step_auth_enabled: { $ne: true } });
  assert.equal(mutation.$set.two_step_auth_enabled, true); assert.equal(mutation.$set.two_step_auth_updated_by, user._id);
  assert.deepEqual(mutation.$inc, { two_step_auth_revision: 1 });
  write.mock.mockImplementation((async () => null) as any);
  assert.equal((await call(user, { enabled: true })).error, undefined);
  assert.deepEqual(scope, { _id: user.account_id, visible: { $ne: false }, account_status: { $ne: 'inactive' } });
  read.mock.mockImplementation((async () => null) as any);
  assert.equal((await call(user, { enabled: false })).error.status, 404);
  assert.equal((await call(user, undefined, getTwoStepSettings)).error.status, 404);
});
