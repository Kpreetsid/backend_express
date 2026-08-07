# Deployment and Rollback

CI builds API `dist` once on Node 24 LTS and publishes signed immutable artifacts with an SBOM and checksums. Production never compiles TypeScript. Angular assets are versioned in S3 and served through CloudFront.

API and workers run in private subnets across at least two availability zones behind an ALB and Auto Scaling groups. CodeDeploy blue-green changes traffic only after target health and smoke tests pass. Alarms trigger automatic rollback.

Terraform owns networking, IAM, ALB, Auto Scaling, storage, alarms, and deployment resources with separate development, staging, and production state. Releases require staging soak, approval, backward-compatible database checks, backup confirmation, and rollback rehearsal.

The API deployment job captures the CodeDeploy deployment ID, waits for the
deployment and automatic-rollback outcome, then verifies both `/health/live`
and dependency-aware `/health/ready` through the production origin. CodeDeploy
state and smoke output are retained for 90 days. A waiter or smoke failure keeps
the release job red and cannot be reported as a successful deployment.

The Angular staging workflow publishes each complete artifact first under
`releases/{commitSha}/`, promotes non-entrypoint assets without deleting the
currently usable hashed files, and writes `ngsw.json` plus `index.html` last.
It waits for CloudFront entrypoint/mutable-asset invalidation and runs a
deployed service-worker smoke check. A manual rollback promotes a verified
immutable release with the same ordered entrypoints, cache controls,
invalidation wait, smoke check, and 90-day evidence retention.

The immutable API artifact contains a compiled, idempotent production index
runner. CodeDeploy executes `scripts/run_database_migrations.sh` after artifact
verification and before starting either PM2 process. It create-applies every
declared index for all 43 registered models plus the reviewed specialized
upload, quota, and PDF-job migrations without compiling TypeScript on the
host. It never drops indexes. A conflict, migration, or configuration failure
stops deployment before the new target can receive traffic.

The launch template configures fixed PM2 JSON-log paths, KMS-encrypted
CloudWatch log groups, memory/disk agent metrics, ALB access logging, HSTS/CSP
SPA headers, operational alarms, and CPU target tracking. CI runs shell/Node
deployment syntax checks plus Terraform format and provider validation before
publishing an artifact.

The release environment must provide `PDF_JOB_RETENTION_DAYS` (default `7`) and
`PDF_JOB_MAX_REQUEST_BYTES` (default `1048576`) through the centralized runtime
configuration. S3 lifecycle rules expire staged PDF input snapshots after two
days and generated PDF objects after eight days; the MongoDB job TTL is governed
by `PDF_JOB_RETENTION_DAYS`.
