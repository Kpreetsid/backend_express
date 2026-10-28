import assert from 'node:assert/strict';
import test from 'node:test';
import { buildUserAccountFilter, pickUserUpdateFields } from './user-update-policy';

test('user mutation filter is bound to account and active visibility', () => {
  assert.deepEqual(buildUserAccountFilter('user-1', 'account-1'), {
    _id: 'user-1',
    account_id: 'account-1',
    visible: { $ne: false }
  });
});

test('user update allowlist rejects tenant, provenance and credential fields', () => {
  assert.deepEqual(pickUserUpdateFields({
    firstName: 'New',
    lastName: 'Name',
    user_role: 'manager',
    user_status: 'inactive',
    phone_no: { code: '+91', number: '123' },
    user_profile_img: 'avatar.png',
    isTourCompleted: false,
    account_id: 'other-account',
    createdBy: 'forged',
    updatedBy: 'forged',
    password: 'forged',
    passwordExpiredAt: new Date(),
    isFirstUser: true,
    isVerified: true
  }), {
    firstName: 'New',
    lastName: 'Name',
    user_role: 'manager',
    user_status: 'inactive',
    phone_no: { code: '+91', number: '123' },
    user_profile_img: 'avatar.png',
    isTourCompleted: false
  });
});
