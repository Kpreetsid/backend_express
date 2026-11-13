import assert from 'node:assert/strict';
import test from 'node:test';
import { UserModel } from '../../models/user.model';
import { TokenModel } from '../../models/userToken.model';
import { tokenSessionStore } from '../../_cache/session/tokenSessionStore';
import { passwordService } from '../../utils/bcrypt';
import { usersService } from '../../masters/user/user.service';
import { MailerService } from '../../_config/mailer';
import { resetPasswordService } from './resetPassword.service';
import { verificationChallenges } from '../verification/verification-challenge.service';
import { userResetPassword } from '../authentication/authentication.service';

const user: any = { _id: '64a000000000000000000001', account_id: '64a000000000000000000002', email: 'user@example.com', firstName: 'Test' };
const proof = 'r'.repeat(43);

test('invalid passwords and mismatched confirmation cannot consume reset proof', async t => {
  let consumed = 0;
  t.mock.method(verificationChallenges, 'consumeResetToken', async () => { consumed++; return { email: user.email }; });
  for (const [password, confirmation] of [['weak', 'weak'], ['Strong1!', 'Different1!'], ['A1!' + 'x'.repeat(73), 'A1!' + 'x'.repeat(73)]]) {
    await assert.rejects(resetPasswordService.completeReset({ email: user.email, token: proof, password, confirmation }));
  }
  assert.equal(consumed, 0);
});

test('reset proof selects the verified user and a failed password write never restores the proof', async t => {
  let consumed = 0;
  t.mock.method(verificationChallenges, 'consumeResetToken', async (token: unknown, email: unknown) => {
    assert.equal(token, proof); assert.equal(email, user.email);
    if (consumed++) throw new Error('proof consumed');
    return { email: user.email };
  });
  t.mock.method(UserModel, 'findOne', (async (filter: any) => {
    assert.equal(filter.email, user.email); assert.equal(filter.user_status, 'active');
    return user;
  }) as any);
  t.mock.method(usersService, 'updateUserPassword', async () => { throw new Error('write failed'); });
  const request = { email: user.email, token: proof, password: 'Strong1!', confirmation: 'Strong1!' };
  await assert.rejects(resetPasswordService.completeReset(request), /write failed/);
  await assert.rejects(resetPasswordService.completeReset(request), /proof consumed/);
});

test('password changes write only password fields and revoke user access, refresh and cached sessions', async t => {
  const events: string[] = [];
  const otherUser = '64a000000000000000000099';
  let sessions = [
    { userId: user._id, principalType: 'user' }, { userId: user._id, principalType: 'refresh_token' },
    { userId: otherUser, principalType: 'user' }, { userId: otherUser, principalType: 'refresh_token' }
  ];
  t.mock.method(passwordService, 'hashPassword', async () => 'hashed-password');
  t.mock.method(UserModel, 'findOneAndUpdate', (async (filter: any, update: any) => {
    assert.equal(String(filter._id), user._id);
    assert.equal(String(filter.account_id), user.account_id);
    assert.deepEqual(Object.keys(update.$set).sort(), ['password', 'passwordExpiredAt']);
    assert.equal(update.$set.password, 'hashed-password');
    assert.ok(update.$set.passwordExpiredAt instanceof Date);
    assert.ok(update.$set.passwordExpiredAt.getTime() > Date.now() + 80 * 86400000);
    events.push('password'); return user;
  }) as any);
  t.mock.method(TokenModel, 'deleteMany', (async (filter: any) => {
    assert.equal(String(filter.userId), user._id);
    assert.ok(JSON.stringify(filter).includes('refresh_token'));
    const principals = filter.$or.find((entry: any) => entry.principalType?.$in).principalType.$in;
    sessions = sessions.filter(session => !(session.userId === String(filter.userId) && principals.includes(session.principalType)));
    events.push('sessions'); return { deletedCount: 2 };
  }) as any);
  t.mock.method(tokenSessionStore, 'deleteUserSessions', async (accountId: string, userId: string) => {
    assert.equal(accountId, user.account_id); assert.equal(userId, user._id); events.push('cache');
  });
  t.mock.method(MailerService.prototype, 'sendPasswordChangeConfirmation', async () => { events.push('email'); return true; });
  await usersService.updateUserPassword(user._id, 'Strong1!', user.account_id);
  assert.deepEqual(events, ['password', 'sessions', 'cache', 'email']);
  assert.equal(sessions.length, 2);
  assert.ok(sessions.every(session => session.userId === otherUser));
});

test('legacy reset rejects access-session tokens without looking up or changing a user', async t => {
  let writes = 0;
  t.mock.method(TokenModel, 'findOne', (async () => null) as any);
  t.mock.method(usersService, 'updateUserPassword', async () => { writes++; });
  let response: any;
  const res: any = { status: () => res, json: (value: any) => { response = value; } };
  let error: any;
  await userResetPassword({ body: { token: 'jwt.access.signature', password: 'Strong1!' } } as any, res, value => { error = value; });
  assert.ok(error);
  assert.equal(error.status, 410);
  assert.equal(response, undefined);
  assert.equal(writes, 0);
});
