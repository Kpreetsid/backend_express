# Production Release and Rollback

## Forward release

API production deployment is manual and uses the `production` GitHub
environment. The dispatch must supply evidence URLs and timestamps for a
minimum one-hour staging soak, a backup confirmed in the preceding 24 hours,
backward-compatible database review, a rollback rehearsal in the preceding 90
days, and a change approval ID. `validate-release-gates.cjs` fails closed and
emits a release-SHA-bound evidence record.

The build job creates one API archive, checksum, SBOM and provenance
attestation. It uploads the exact archive under the commit SHA. CodeDeploy
performs the create-only index migration before PM2 starts API/worker processes,
switches blue-green traffic only after readiness, and rolls back on configured
alarms. Post-deployment smoke and ZAP baseline scans are release gates.

The APP staging workflow deploys the checksum-verified attested archive that
was tested by Playwright. Production promotion downloads that same artifact by
build run ID and commit SHA, verifies checksum and GitHub attestation, requires
named/unexpired frozen-dependency approval, validates recovery evidence, then
promotes CloudFront entrypoints last.

## Rollback

Use the API or APP production rollback workflow with an exact prior commit SHA
and approved change/incident ID. Rollback intentionally does not require the
forward dependency-risk exception: restoring a known working artifact must
remain possible during an incident. Each workflow verifies that the immutable
artifact/release exists, performs readiness or SPA smoke checks, and retains
authorization plus deployment evidence.

Never rebuild an old commit, mutate an artifact in place, compile TypeScript on
an instance, or apply a backward-incompatible migration during rollback.
