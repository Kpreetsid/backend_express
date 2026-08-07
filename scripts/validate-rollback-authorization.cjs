const validateRollbackAuthorization = (environment, now = new Date()) => {
  const artifactSha = String(environment.ROLLBACK_ARTIFACT_SHA || '').trim().toLowerCase();
  const authorizationId = String(environment.ROLLBACK_AUTHORIZATION_ID || '').trim();
  if (!/^[0-9a-f]{40}$/.test(artifactSha)) {
    throw new Error('ROLLBACK_ARTIFACT_SHA must be the exact 40-character artifact commit SHA');
  }
  if (!/^[a-z0-9][a-z0-9._-]{5,63}$/i.test(authorizationId)) {
    throw new Error('ROLLBACK_AUTHORIZATION_ID must be a 6-64 character change or incident identifier');
  }
  return {
    schemaVersion: 1,
    artifactSha,
    authorizationId,
    validatedAt: now.toISOString()
  };
};

if (require.main === module) {
  try {
    process.stdout.write(`${JSON.stringify(validateRollbackAuthorization(process.env), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { validateRollbackAuthorization };
