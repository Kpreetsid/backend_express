# Upload and File Lifecycle

Existing upload routes and response shapes remain unchanged while storage moves from instance disk to private S3.

Before persistence, validate tenant authorization, quota, maximum size, extension, declared MIME type, and file signature. Malware scanning is required before a file becomes downloadable. MongoDB stores metadata and checksum; S3 uses private encryption, short-lived signed access, least-privilege IAM, and lifecycle rules.

Tenant storage quota is enforced before object persistence with an atomic
MongoDB reservation. Concurrent requests cannot collectively exceed
`UPLOAD_TENANT_QUOTA_BYTES`; successful metadata persistence commits reserved
bytes to active usage, and every failed write or rolled-back multipart batch
releases its reservation. Deletion releases active usage exactly once.
Production requires a positive quota; `0` is accepted only outside production
as an unlimited compatibility default. Pending reservations expire after
`UPLOAD_QUOTA_RESERVATION_TTL_SECONDS` (default 900).

Quota denial preserves existing upload routes and response envelopes and
returns HTTP 507 with `data.code=UPLOAD_QUOTA_EXCEEDED` plus quota, used,
remaining, and requested byte counts. The Angular global error handler displays
the backend-authoritative message.

New multipart and base64 uploads now create an immutable
`stored_upload_metadata` record containing tenant and actor ownership, original
and stored names, normalized storage key, MIME type, size, SHA-256 checksum,
storage driver, and clean scan state. Mutable lifecycle fields record deletion
without changing the physical-file facts. A metadata write failure deletes the
newly written object, and tenant ownership is checked before a tracked object is
deleted. Existing route paths and response fields are unchanged.

Apply the reviewed production indexes before enabling metadata writes:

```powershell
npm run migrate:stored-upload-indexes
npm run migrate:upload-quota-indexes
```

Before enabling quota for existing tenants, reconcile metadata, pending
reservations, and ledgers in a maintenance/read-only window. The command is
dry-run unless `--execute` is supplied and never overwrites a report:

```powershell
npm run uploads:quota-reconcile -- --report <quota-report.json>
npm run uploads:quota-reconcile -- --report <quota-report.json> --execute
```

Approve a zero-mismatch follow-up report before resuming writes. Running
reconciliation concurrently with uploads is prohibited because it is an
operational repair tool, not an online accounting path.

Migration uses checksum-verified copy, dual-read fallback, reconciliation reporting, and a reversible cutover. Local storage remains a development-only driver. Filenames are never trusted as filesystem paths or authorization evidence.

The migration command is dry-run by default and writes a new, non-overwriting
JSON reconciliation report. It never changes or deletes the local source:

```powershell
npm run uploads:migrate -- --source <uploadFiles> --report <report.json>
npm run uploads:migrate -- --source <uploadFiles> --report <report.json> --execute
```

Execution uploads each object with an S3 SHA-256 checksum, verifies its size and
checksum again with `HeadObject`, and returns non-zero if reconciliation finds
any failure. Retain the local tree until the signed report is approved and the
dual-read/cutover exercise succeeds in staging.

During the reversible cutover only, set:

```text
STORAGE_DRIVER=s3
S3_DUAL_READ_LOCAL_FALLBACK_ENABLED=true
S3_DUAL_READ_LOCAL_BASE_URL=https://api.example
```

Reads check S3 first and use the local source only when the object is absent.
Uploads, deletes, checksum verification, and readiness remain S3-only. The
legacy `uploadFiles` tree must be mounted read-only and consistently on every
serving instance (or requests must be routed to a dedicated migration origin).
Disable the flag and remove the legacy mount immediately after the reconciliation
report reaches zero failures and staging smoke tests pass. Production startup
rejects the fallback without an explicit legacy base URL.

Asset PDF tenant images and attachments are read through the same storage
abstraction and are checked against the requesting tenant before rendering.
S3-only report generation and the temporary local-read fallback therefore use
the same code path. Packaged report templates, the ECharts renderer, logo, and
report icons remain immutable application resources rather than tenant uploads.
