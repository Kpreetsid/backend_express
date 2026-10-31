import test from 'node:test';
import assert from 'node:assert/strict';
import { SupportLoginCredential, consumeSupportLoginToken, supportServiceAuthorized, SUPPORT_LOGIN_TTL_MS } from './support-login.service';
import { UserModel } from '../../users/models/user.model';
import { AccountModel } from '../../company/models/account.model';

test('service key authentication fails closed and requires an exact dedicated secret', () => {
  assert.equal(SUPPORT_LOGIN_TTL_MS, 300000);
  assert.equal(supportServiceAuthorized('', ''), false);
  assert.equal(supportServiceAuthorized('short', 'short'), false);
  assert.equal(supportServiceAuthorized('a'.repeat(32), 'b'.repeat(32)), false);
  assert.equal(supportServiceAuthorized('a'.repeat(32), 'a'.repeat(32)), true);
});
test('malformed support credentials never reach the database', async t => {
  const find = t.mock.method(SupportLoginCredential, 'findOneAndUpdate', async () => { throw Error('database accessed'); });
  await assert.rejects(consumeSupportLoginToken('not-a-support-token'), /Invalid or expired/);
  assert.equal(find.mock.callCount(), 0);
});
test('expired or consumed support tokens cannot create another session', async t => {
  t.mock.method(SupportLoginCredential, 'findOneAndUpdate', async (query: any) => {
    assert.deepEqual(query.consumedAt, { $exists: false });
    assert.ok(query.expiresAt.$gt instanceof Date);
    return null;
  });
  await assert.rejects(consumeSupportLoginToken('spt_' + 'a'.repeat(43)), /Invalid or expired/);
});
test('single-use exchange returns current recipient identity and staff provenance', async t => {
  let consumed = false;
  t.mock.method(SupportLoginCredential, 'findOneAndUpdate', async () => {
    if (consumed) return null;
    consumed = true;
    return { _id: 'credential', userId: 'user', accountId: 'account', actorId: 'actor', reason: 'Support reason' };
  });
  t.mock.method(UserModel, 'findOne', (() => Promise.resolve({ email: 'current@example.com' })) as any);
  t.mock.method(AccountModel, 'findOne', (() => Promise.resolve({ account_status: 'active' })) as any);
  const raw = 'spt_' + 'a'.repeat(43);
  const result = await consumeSupportLoginToken(raw);
  assert.equal(result.email, 'current@example.com'); assert.equal(result.org_id, 'account');
  assert.equal(result.supportActor.actorId, 'actor');
  await assert.rejects(consumeSupportLoginToken(raw), /Invalid or expired/);
});
