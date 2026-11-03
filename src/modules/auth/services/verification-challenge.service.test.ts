import assert from 'node:assert/strict';
import test from 'node:test';
import { VerificationCodeModel } from '@modules/auth/models/userVerification.model';
import { verificationChallenges } from './verification-challenge.service';

// An in-memory persistence boundary: never connect to MongoDB or Redis.
function records(t: any) {
  let record: any = null;
  const matches = (filter: any) => record &&
    (!filter.email || record.email === filter.email) &&
    (!filter.code || record.code === filter.code) &&
    (!filter.createdAt || (record.createdAt > filter.createdAt.$gt && record.createdAt <= filter.createdAt.$lte));
  t.mock.method(VerificationCodeModel, 'findOneAndUpdate', async (filter: any, update: any, options: any) => {
    if (!options?.upsert && !matches(filter)) return null;
    record = { _id: 'challenge', ...record, ...filter, ...update.$set };
    return { ...record };
  });
  t.mock.method(VerificationCodeModel, 'findOneAndDelete', async (filter: any) => {
    if (!matches(filter)) return null;
    const consumed = record;
    record = null;
    return consumed;
  });
  return { get: () => record, set: (value: any) => { record = value; } };
}

const user = { email: 'test@example.com', firstName: 'Test' };

test('Mongoose preserves explicit issuance and grant timestamps at the collection boundary', async t => {
  let calls = 0;
  const identities: string[] = [];
  t.mock.method(VerificationCodeModel.collection, 'findOneAndUpdate', (async (filter: any, update: any) => {
    if (filter._id) identities.push(String(filter._id));
    assert.ok(update.$set.createdAt instanceof Date, 'createdAt must survive Mongoose immutable casting');
    assert.ok(Math.abs(update.$set.createdAt.getTime() - Date.now()) < 1000);
    calls++;
    return { email: user.email, ...update.$set };
  }) as any);
  const otp = await verificationChallenges.issueOtp(user, 'password-reset');
  await verificationChallenges.issueOtp(user, 'registration');
  await verificationChallenges.exchangeResetOtp(user.email, otp);
  assert.equal(calls, 3);
  assert.match(identities[0], /^[a-f0-9]{24}$/);
  assert.equal(identities[0], identities[1], 'all issuance uses one existing unique _id per email');
});

test('OTP issuance stores a purpose-bound hash, never the six-digit secret', async t => {
  const db = records(t);
  const otp = await verificationChallenges.issueOtp(user, 'registration');
  assert.match(otp, /^\d{6}$/);
  assert.match(db.get().code, /^otp:registration:[a-f0-9]{64}$/);
  assert.ok(!db.get().code.includes(otp));
  assert.equal(db.get().email, user.email);
});

test('OTP verification rejects incorrect, wrong-purpose and plaintext legacy codes', async t => {
  const db = records(t);
  const otp = await verificationChallenges.issueOtp(user, 'registration');
  await assert.rejects(verificationChallenges.consumeOtp(user.email, '000000', 'registration'));
  await assert.rejects(verificationChallenges.consumeOtp(user.email, otp, 'email-verification'));
  db.set({ email: user.email, code: otp, createdAt: new Date() });
  await assert.rejects(verificationChallenges.consumeOtp(user.email, otp, 'registration'));
});

test('expired and future-dated OTPs fail even if the TTL record still exists', async t => {
  const db = records(t);
  const otp = await verificationChallenges.issueOtp(user, 'registration');
  const record = { ...db.get() };
  for (const timestamp of [Date.now() - 30 * 60_000, Date.now() + 60_000]) {
    db.set({ ...record, createdAt: new Date(timestamp) });
    await assert.rejects(verificationChallenges.consumeOtp(user.email, otp, 'registration'));
  }
});

for (const purpose of ['registration', 'email-verification'] as const) {
  test(`${purpose} OTP can be consumed only once under concurrent requests`, async t => {
    records(t);
    const otp = await verificationChallenges.issueOtp(user, purpose);
    const results = await Promise.allSettled([
      verificationChallenges.consumeOtp(user.email, otp, purpose),
      verificationChallenges.consumeOtp(user.email, otp, purpose)
    ]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  });
}

test('password-reset OTP exchanges once for an opaque, hashed, email-bound grant', async t => {
  const db = records(t);
  const otp = await verificationChallenges.issueOtp(user, 'password-reset');
  const results = await Promise.allSettled([
    verificationChallenges.exchangeResetOtp(user.email, otp),
    verificationChallenges.exchangeResetOtp(user.email, otp)
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  const token = (results.find(result => result.status === 'fulfilled') as PromiseFulfilledResult<string>).value;
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(db.get().code, token);
  await assert.rejects(verificationChallenges.consumeResetToken(token, 'other@example.com'));
  const consumed = await Promise.allSettled([
    verificationChallenges.consumeResetToken(token, user.email),
    verificationChallenges.consumeResetToken(token, user.email)
  ]);
  assert.equal(consumed.filter(result => result.status === 'fulfilled').length, 1);
  await assert.rejects(verificationChallenges.consumeResetToken(token, user.email));
});

test('reset grants expire at five minutes and cannot be replaced by OTP or session tokens', async t => {
  const db = records(t);
  const otp = await verificationChallenges.issueOtp(user, 'password-reset');
  const token = await verificationChallenges.exchangeResetOtp(user.email, otp);
  for (const invalid of [otp, 'eyJhbGciOiJIUzI1NiJ9.access.signature', 'external-login-token', '', null]) {
    await assert.rejects(verificationChallenges.consumeResetToken(invalid, user.email));
  }
  db.set({ ...db.get(), createdAt: new Date(Date.now() - 5 * 60_000) });
  await assert.rejects(verificationChallenges.consumeResetToken(token, user.email));
});
