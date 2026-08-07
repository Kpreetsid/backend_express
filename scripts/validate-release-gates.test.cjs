const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { validateReleaseEvidence } = require('./validate-release-gates.cjs');

const now = new Date('2026-08-01T12:00:00.000Z');
const validEnvironment = () => ({
  RELEASE_SHA: 'a'.repeat(40),
  CHANGE_APPROVAL_ID: 'CHG-123456',
  STAGING_SOAK_EVIDENCE_URL: 'https://evidence.example.test/soak/a',
  STAGING_SOAK_STARTED_AT: '2026-08-01T08:00:00.000Z',
  STAGING_SOAK_ENDED_AT: '2026-08-01T10:00:00.000Z',
  BACKUP_EVIDENCE_URL: 'https://evidence.example.test/backup/1',
  BACKUP_CONFIRMED_AT: '2026-08-01T11:00:00.000Z',
  DATABASE_COMPATIBILITY_EVIDENCE_URL: 'https://evidence.example.test/database/a',
  ROLLBACK_EVIDENCE_URL: 'https://evidence.example.test/rollback/1',
  ROLLBACK_REHEARSED_AT: '2026-07-15T09:00:00.000Z'
});

describe('production release evidence gate', () => {
  it('emits a versioned, non-secret evidence record for a valid release', () => {
    const evidence = validateReleaseEvidence(validEnvironment(), now);
    assert.equal(evidence.schemaVersion, 1);
    assert.equal(evidence.releaseSha, 'a'.repeat(40));
    assert.equal(evidence.changeApprovalId, 'CHG-123456');
    assert.equal(evidence.stagingSoak.startedAt, '2026-08-01T08:00:00.000Z');
    assert.equal(evidence.backup.confirmedAt, '2026-08-01T11:00:00.000Z');
  });

  it('rejects missing governance identity and unsafe evidence URLs', () => {
    const environment = validEnvironment();
    environment.RELEASE_SHA = 'short';
    environment.CHANGE_APPROVAL_ID = 'x';
    environment.BACKUP_EVIDENCE_URL = 'http://user:pass@evidence.example.test/backup';
    assert.throws(
      () => validateReleaseEvidence(environment, now),
      /RELEASE_SHA.*CHANGE_APPROVAL_ID.*BACKUP_EVIDENCE_URL must use HTTPS.*must not contain URL credentials/s
    );
  });

  it('rejects short/future soak, stale backup, and stale rollback evidence', () => {
    const environment = validEnvironment();
    environment.STAGING_SOAK_STARTED_AT = '2026-08-01T12:30:00.000Z';
    environment.STAGING_SOAK_ENDED_AT = '2026-08-01T13:00:00.000Z';
    environment.BACKUP_CONFIRMED_AT = '2026-07-30T10:00:00.000Z';
    environment.ROLLBACK_REHEARSED_AT = '2026-04-01T10:00:00.000Z';
    assert.throws(
      () => validateReleaseEvidence(environment, now),
      /at least one hour.*cannot be in the future.*no older than 24 hours.*no older than 90 days/s
    );
  });
});
