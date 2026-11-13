import test from 'node:test';
import assert from 'node:assert/strict';
import { establishExternalSession } from './authentication.service';
import { UserModel } from '../../users/models/user.model';
import { companyService } from '../../company/services/company.service';
import { rolesService } from '../../users/services/roles.service';
import { TokenModel } from '../models/userToken.model';
import { refreshTokenService } from './refreshToken.service';

test('email, support and legacy external session boundary rejects current TFA policy before session side effects', async t => {
  const user = { _id: '63a1492110c33e75c8232931', account_id: '63a1492110c33e75c8232932',
    email: 'user@example.test', toObject() { return this; } };
  t.mock.method(UserModel, 'findOne', (async () => user) as any);
  t.mock.method(companyService, 'getAllCompanies', (async () => [{ _id: user.account_id, two_step_auth_enabled: true }]) as any);
  const role = t.mock.method(rolesService, 'verifyUserRole', async () => { throw Error('must not initialize roles'); });
  const save = t.mock.method(TokenModel.prototype, 'save', async function () { throw Error('must not save tokens'); });
  const refresh = t.mock.method(refreshTokenService, 'issueForUser', async () => { throw Error('must not issue refresh'); });
  for (const isInternal of [true, false]) {
    let error: any;
    await establishExternalSession({} as any, { cookie() { assert.fail('must not set cookies'); } } as any,
      value => { error = value; }, { email: user.email, org_id: user.account_id, userId: user._id, isInternal, isExternal: false });
    assert.equal(error?.status, 403); assert.equal(error?.code, 'TWO_STEP_PASSWORD_LOGIN_REQUIRED');
  }
  assert.equal(role.mock.callCount(), 0); assert.equal(save.mock.callCount(), 0); assert.equal(refresh.mock.callCount(), 0);
});
