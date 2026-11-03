import assert from 'node:assert/strict';
import test from 'node:test';
import { passwordExpiryNotice, nextPasswordExpiry } from './password-expiry';
import { checkPasswordExpire } from '@common/middlewares/password-expire.middleware';
import { usersService } from '@modules/users/services/user.service';

test('today and earlier expiry dates warn, future and absent dates do not', () => {
  const now = new Date('2026-10-19T05:00:00.000Z');
  for (const [value, expected] of [
    ['2026-10-19T18:29:59.000Z', true], ['2026-10-18T00:00:00.000Z', true],
    ['2026-10-19T18:30:00.000Z', false], [undefined, false], [null, false], ['invalid', false]
  ] as const) {
    assert.equal(passwordExpiryNotice(value, now).passwordExpired, expected);
  }
  assert.match(passwordExpiryNotice('2026-10-19', now).passwordExpiryMessage, /password.*too old/i);
});

test('expiry is based on the India calendar day, not elapsed hours or host timezone', () => {
  assert.equal(passwordExpiryNotice('2026-10-19T00:00:00Z', new Date('2026-10-18T18:30:00Z')).passwordExpired, true);
  assert.equal(passwordExpiryNotice('2026-10-19T00:00:00Z', new Date('2026-10-18T18:29:59Z')).passwordExpired, false);
});

test('password changes schedule three calendar months with month-end clamping', () => {
  assert.equal(nextPasswordExpiry(new Date('2026-10-19T05:00:00Z')).toISOString(), '2027-01-19T05:00:00.000Z');
  assert.equal(nextPasswordExpiry(new Date('2026-01-31T05:00:00Z')).toISOString(), '2026-04-30T05:00:00.000Z');
  assert.equal(nextPasswordExpiry(new Date('2026-11-30T05:00:00Z')).toISOString(), '2027-02-28T05:00:00.000Z');
  assert.equal(nextPasswordExpiry(new Date('2026-01-30T20:00:00Z')).toISOString(), '2026-04-29T20:00:00.000Z');
});

test('expiry middleware never blocks login or looks up credentials', async t => {
  let lookups = 0;
  t.mock.method(usersService, 'getUserDetails', async () => { lookups++; return { passwordExpiredAt: new Date('2020-01-01') } as any; });
  let error: any;
  let calls = 0;
  await checkPasswordExpire({ body: { username: 'test' } }, {} as any, value => { calls++; error = value; });
  assert.equal(error, undefined);
  assert.equal(calls, 1);
  assert.equal(lookups, 0);
});
