import assert from 'node:assert/strict';
import test from 'node:test';
import { userController } from './user.controller';
import { usersService } from '../services/user.service';
import { subscriptionLimitService } from '../../company/services/subscriptionLimit.service';

test('reactivating an inactive user checks the account seat limit before writing', async t => {
  const id = '111111111111111111111111';
  const account = '222222222222222222222222';
  let checked = false;
  let writes = 0;
  let error: any;
  t.mock.method(usersService, 'getAllUsers', async () => [{ _id: id, account_id: account, user_role: 'employee', user_status: 'inactive' }] as any);
  t.mock.method(subscriptionLimitService, 'assertCanCreate', async (accountId: any, resource: any) => {
    assert.equal(accountId, account);
    assert.equal(resource, 'user');
    checked = true;
    throw Object.assign(new Error('Seat limit reached'), { status: 403 });
  });
  t.mock.method(usersService, 'updateUserDetails', async () => { writes++; return null; });
  const req: any = { params: { id }, body: { user_status: 'active' }, user: { _id: '333333333333333333333333', account_id: account, user_role: 'admin' } };
  await userController.updateUser(req, { once: () => undefined } as any, value => { error = value; });
  assert.equal(error?.status, 403);
  assert.equal(checked, true);
  assert.equal(writes, 0);
});
