# Local Upload to S3 Cutover

## Preconditions

- Private/versioned/encrypted S3, malware scanner, upload metadata/quota
  indexes, managed Redis and current API/worker artifact are deployed.
- A backup and rollback authorization exist.
- `S3_DUAL_READ_LOCAL_FALLBACK_ENABLED` is enabled only for the bounded
  migration window; every write is already S3-first.

## Procedure

1. Run `npm run uploads:migrate -- --dry-run` through the runtime-secret wrapper
   from an isolated operations target. Retain counts by tenant/type, byte totals,
   missing sources, unsafe paths, and checksum failures.
2. Resolve every dry-run failure. Do not skip tenant ownership or MIME/malware
   validation to make reconciliation green.
3. Apply upload metadata and quota indexes, enter the documented maintenance
   window, and run `npm run uploads:quota-reconcile -- --dry-run`.
4. Execute migration in bounded batches. Verify SHA-256 after upload and retain
   only metadata/evidence, never file contents.
5. Execute quota reconciliation and compare stored-object totals, metadata,
   quota ledgers, and pending reservation counts for every tenant.
6. Exercise signed download authorization from two tenants and prove denial of
   cross-tenant access. Verify local fallback serves only an expected legacy
   miss and never a tenant mismatch.
7. After the approved observation window reaches zero fallback reads, disable
   dual read and deploy. Keep local files recoverable until final sign-off.

## Rollback

Re-enable the same bounded dual-read flag and restore the prior immutable API
artifact. Do not delete S3 copies or metadata. Reconcile again before another
cutover attempt.

Certification requires zero checksum/ownership/quota discrepancies and named
Storage/Security approval.
