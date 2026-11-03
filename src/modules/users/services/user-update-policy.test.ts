import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLocationAccountFilter, buildMappedUserFilter, buildUserAccountFilter, canAssignUserRole, canModifyUserRecord, isProtectedFirstUserMutation, pickUserCreateFields, pickUserUpdateFields, shouldRevokeUserSessionsAfterUpdate } from './user-update-policy';

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


test('user create allowlist rejects tenant and internal verification flags', () => {
  assert.deepEqual(pickUserCreateFields({
    firstName: 'New',
    lastName: 'User',
    username: 'new.user',
    password: 'Secret123',
    email: 'new@example.com',
    user_role: 'employee',
    phone_no: { code: '+91', number: '123' },
    account_id: 'other-account',
    createdBy: 'forged',
    isFirstUser: true,
    isVerified: true,
    passwordExpiredAt: new Date()
  }), {
    firstName: 'New',
    lastName: 'User',
    username: 'new.user',
    password: 'Secret123',
    email: 'new@example.com',
    user_role: 'employee',
    phone_no: { code: '+91', number: '123' }
  });
});


test('location-wise users require both location and returned users to match the account', () => {
  assert.deepEqual(buildLocationAccountFilter('location-1', 'account-1'), {
    _id: 'location-1',
    account_id: 'account-1',
    visible: { $ne: false }
  });
  assert.deepEqual(buildMappedUserFilter(['user-1', 'user-2'], 'account-1'), {
    _id: { $in: ['user-1', 'user-2'] },
    account_id: 'account-1',
    visible: { $ne: false }
  });
});


test('only administrators may assign privileged roles', () => {
  assert.equal(canAssignUserRole('admin', 'admin', 'employee'), true);
  assert.equal(canAssignUserRole('manager', 'manager', 'employee'), false);
  assert.equal(canAssignUserRole('manager', 'employee', 'employee'), true);
  assert.equal(canAssignUserRole('manager', 'employee', 'admin'), false);
  assert.equal(canAssignUserRole('employee', 'employee', 'employee'), false);
});

test('authorization-sensitive profile changes require session revocation', () => {
  const current = { user_role: 'employee', user_status: 'active', email: 'a@example.com', username: 'a' };
  assert.equal(shouldRevokeUserSessionsAfterUpdate(current, { firstName: 'B' } as any), false);
  assert.equal(shouldRevokeUserSessionsAfterUpdate(current, { user_role: 'manager' }), true);
  assert.equal(shouldRevokeUserSessionsAfterUpdate(current, { user_status: 'inactive' }), true);
  assert.equal(shouldRevokeUserSessionsAfterUpdate(current, { email: 'b@example.com' }), true);
  assert.equal(shouldRevokeUserSessionsAfterUpdate(current, { username: 'b' }), true);
});


test('first account user cannot be demoted or deactivated through profile mutation', () => {
  const owner = { isFirstUser: true, user_role: 'admin', user_status: 'active' };
  assert.equal(isProtectedFirstUserMutation(owner, { user_role: 'manager' }), true);
  assert.equal(isProtectedFirstUserMutation(owner, { user_status: 'inactive' }), true);
  assert.equal(isProtectedFirstUserMutation(owner, { firstName: 'Owner' } as any), false);
  assert.equal(isProtectedFirstUserMutation({ isFirstUser: false }, { user_role: 'manager' }), false);
});

test('manager cannot edit privileged identities or perform account role escalation', () => {
  const manager = { _id: 'manager-1', user_role: 'manager', isFirstUser: false };
  const peer = { _id: 'employee-1', user_role: 'employee', isFirstUser: false };
  const admin = { _id: 'admin-1', user_role: 'admin', isFirstUser: false };
  assert.equal(canModifyUserRecord(manager, manager, { user_role: 'admin' }), false);
  assert.equal(canModifyUserRecord(manager, manager, { email: 'changed@example.com' }), false);
  assert.equal(canModifyUserRecord(manager, peer, { user_status: 'inactive' }), false);
  assert.equal(canModifyUserRecord(manager, admin, { firstName: 'Tampered' }), false);
  assert.equal(canModifyUserRecord(manager, peer, { firstName: 'Allowed' }), true);
});

test('administrator cannot take over the first user or change their own privileged identity', () => {
  const admin = { _id: 'admin-2', user_role: 'admin', isFirstUser: false };
  const owner = { _id: 'owner-1', user_role: 'admin', isFirstUser: true };
  const peer = { _id: 'employee-1', user_role: 'employee', isFirstUser: false };
  assert.equal(canModifyUserRecord(admin, owner, { email: 'takeover@example.com' }), false);
  assert.equal(canModifyUserRecord(admin, admin, { user_role: 'manager' }), false);
  assert.equal(canModifyUserRecord(admin, admin, { email: 'self@example.com' }), false);
  assert.equal(canModifyUserRecord(admin, peer, { firstName: 'Allowed' }), true);
  assert.equal(canModifyUserRecord(owner, peer, { user_role: 'admin' }), true);
});
