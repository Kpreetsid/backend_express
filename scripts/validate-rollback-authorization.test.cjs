const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateRollbackAuthorization } = require('./validate-rollback-authorization.cjs');

test('binds API rollback authorization to an exact immutable artifact', () => {
  const evidence = validateRollbackAuthorization({
    ROLLBACK_ARTIFACT_SHA: 'd'.repeat(40),
    ROLLBACK_AUTHORIZATION_ID: 'INC-987654'
  }, new Date('2026-08-01T12:00:00.000Z'));
  assert.equal(evidence.artifactSha, 'd'.repeat(40));
  assert.equal(evidence.authorizationId, 'INC-987654');
  assert.equal(evidence.validatedAt, '2026-08-01T12:00:00.000Z');
});

test('rejects ambiguous API rollback target and authorization', () => {
  assert.throws(
    () => validateRollbackAuthorization({
      ROLLBACK_ARTIFACT_SHA: 'previous',
      ROLLBACK_AUTHORIZATION_ID: 'INC-987654'
    }),
    /ROLLBACK_ARTIFACT_SHA/
  );
  assert.throws(
    () => validateRollbackAuthorization({
      ROLLBACK_ARTIFACT_SHA: 'd'.repeat(40),
      ROLLBACK_AUTHORIZATION_ID: '../bad'
    }),
    /ROLLBACK_AUTHORIZATION_ID/
  );
});
