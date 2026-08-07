const requiredEvidenceFields = Object.freeze([
  'STAGING_SOAK_EVIDENCE_URL',
  'BACKUP_EVIDENCE_URL',
  'DATABASE_COMPATIBILITY_EVIDENCE_URL',
  'ROLLBACK_EVIDENCE_URL'
]);

const parseTimestamp = (value, name, failures) => {
  const date = new Date(String(value || ''));
  if (!Number.isFinite(date.getTime())) {
    failures.push(`${name} must be an ISO-8601 timestamp`);
    return undefined;
  }
  return date;
};

const validateEvidenceUrl = (value, name, failures) => {
  try {
    const url = new URL(String(value || ''));
    if (url.protocol !== 'https:') failures.push(`${name} must use HTTPS`);
    if (url.username || url.password) failures.push(`${name} must not contain URL credentials`);
    if (url.href.length > 2048) failures.push(`${name} is too long`);
    return url.href;
  } catch {
    failures.push(`${name} must be a valid evidence URL`);
    return undefined;
  }
};

const validateReleaseEvidence = (environment, now = new Date()) => {
  const failures = [];
  const releaseSha = String(environment.RELEASE_SHA || '').trim().toLowerCase();
  const changeApprovalId = String(environment.CHANGE_APPROVAL_ID || '').trim();

  if (!/^[0-9a-f]{40}$/.test(releaseSha)) {
    failures.push('RELEASE_SHA must be the exact 40-character commit SHA');
  }
  if (!/^[a-z0-9][a-z0-9._-]{5,63}$/i.test(changeApprovalId)) {
    failures.push('CHANGE_APPROVAL_ID must be a 6-64 character governance identifier');
  }

  const evidenceUrls = {};
  for (const name of requiredEvidenceFields) {
    evidenceUrls[name] = validateEvidenceUrl(environment[name], name, failures);
  }

  const soakStartedAt = parseTimestamp(environment.STAGING_SOAK_STARTED_AT, 'STAGING_SOAK_STARTED_AT', failures);
  const soakEndedAt = parseTimestamp(environment.STAGING_SOAK_ENDED_AT, 'STAGING_SOAK_ENDED_AT', failures);
  const backupConfirmedAt = parseTimestamp(environment.BACKUP_CONFIRMED_AT, 'BACKUP_CONFIRMED_AT', failures);
  const rollbackRehearsedAt = parseTimestamp(environment.ROLLBACK_REHEARSED_AT, 'ROLLBACK_REHEARSED_AT', failures);
  const maximumFutureSkewMs = 5 * 60 * 1000;

  if (soakStartedAt && soakEndedAt) {
    const soakDurationMs = soakEndedAt.getTime() - soakStartedAt.getTime();
    if (soakDurationMs < 60 * 60 * 1000) {
      failures.push('staging soak must run for at least one hour');
    }
    if (soakEndedAt.getTime() > now.getTime() + maximumFutureSkewMs) {
      failures.push('STAGING_SOAK_ENDED_AT cannot be in the future');
    }
  }
  if (backupConfirmedAt) {
    const ageMs = now.getTime() - backupConfirmedAt.getTime();
    if (ageMs < -maximumFutureSkewMs || ageMs > 24 * 60 * 60 * 1000) {
      failures.push('backup confirmation must be no older than 24 hours and not in the future');
    }
  }
  if (rollbackRehearsedAt) {
    const ageMs = now.getTime() - rollbackRehearsedAt.getTime();
    if (ageMs < -maximumFutureSkewMs || ageMs > 90 * 24 * 60 * 60 * 1000) {
      failures.push('rollback rehearsal must be no older than 90 days and not in the future');
    }
  }

  if (failures.length) {
    throw new Error(`Release evidence gate failed:\n- ${failures.join('\n- ')}`);
  }

  return {
    schemaVersion: 1,
    releaseSha,
    changeApprovalId,
    validatedAt: now.toISOString(),
    stagingSoak: {
      startedAt: soakStartedAt.toISOString(),
      endedAt: soakEndedAt.toISOString(),
      evidenceUrl: evidenceUrls.STAGING_SOAK_EVIDENCE_URL
    },
    backup: {
      confirmedAt: backupConfirmedAt.toISOString(),
      evidenceUrl: evidenceUrls.BACKUP_EVIDENCE_URL
    },
    databaseCompatibility: {
      evidenceUrl: evidenceUrls.DATABASE_COMPATIBILITY_EVIDENCE_URL
    },
    rollbackRehearsal: {
      rehearsedAt: rollbackRehearsedAt.toISOString(),
      evidenceUrl: evidenceUrls.ROLLBACK_EVIDENCE_URL
    }
  };
};

if (require.main === module) {
  try {
    process.stdout.write(`${JSON.stringify(validateReleaseEvidence(process.env), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { validateReleaseEvidence };
