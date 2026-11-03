import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EXTERNAL_LOGIN_GRANT_TTL_SECONDS,
  buildGrantConsumeFilter,
  createOpaqueGrantCode,
  hashGrantSecret
} from './external-login-grant.service';

test('opaque support grant uses at least 256 bits and only its hash is suitable for persistence', () => {
  const code = createOpaqueGrantCode();
  assert.ok(code.length >= 43);
  assert.notEqual(hashGrantSecret(code), code);
  assert.equal(hashGrantSecret(code).length, 64);
});

test('grant consumption is bound to browser state, environment, issuer, audience and purpose', () => {
  const now = new Date('2026-10-28T10:00:00.000Z');
  const filter: any = buildGrantConsumeFilter('grant-code', 'state-proof-abcdefghijklmnopqrstuvwxyz123456', 'staging', now);
  assert.equal(filter._id, hashGrantSecret('grant-code'));
  assert.equal(filter.stateHash, hashGrantSecret('state-proof-abcdefghijklmnopqrstuvwxyz123456'));
  assert.equal(filter.environment, 'staging');
  assert.equal(filter.issuer, 'internal-admin');
  assert.equal(filter.audience, 'cmms-web');
  assert.equal(filter.purpose, 'support.login');
  assert.equal(filter.expiresAt.$gt, now);
  assert.deepEqual(filter.consumedAt, { $exists: false });
  assert.equal(EXTERNAL_LOGIN_GRANT_TTL_SECONDS, 60);
});
