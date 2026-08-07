# Security Standard

## Mandatory controls

- Deny cross-tenant access at service and repository boundaries and test every resource family.
- Preserve payload encryption as secure-by-default. Its existing headers and configuration names are compatibility contracts.
- Keep secrets outside source control in AWS Secrets Manager, encrypted with KMS, and inject them at runtime through least-privilege IAM roles.
- Require TLS, restrictive CORS, CSP/Helmet, WAF-managed rules, dependency and secret scanning, and annual access reviews.
- Redact credentials, tokens, cookies, encryption material, personal data, and file contents from logs.

## Security gates

Critical vulnerabilities block merge. High vulnerabilities block release unless a named owner records an expiring risk acceptance. Authentication, authorization, crypto, tenant isolation, upload, and transaction changes require threat-model review and 90% changed-code coverage.

## Data classification

| Class | Examples | Minimum controls |
|---|---|---|
| Restricted | credentials, refresh tokens, crypto secrets | KMS encryption, no logs, smallest access set |
| Confidential | tenant records, work history, uploaded files | tenant authorization, encrypted transit/storage, audit trail |
| Internal | operational metrics, non-sensitive configuration | authenticated staff access |
| Public | published help/static assets | integrity and cache controls |

Report suspected incidents through the incident runbook. Never copy production data into development without approved de-identification.

## Current tenant-boundary evidence

- Work-request notification events derive tenant and actor identity only from
  the authenticated request and share the mutation transaction.
- Work-request detail query parameters cannot replace server-derived `_id`,
  `account_id`, or visibility scope.
- Work-order assignee create/update validates the work order and every active
  user against the authenticated account before writing.
- Work-order assignee mapped-data reads and deletes perform the same work-order
  ownership check before accessing mapping records.
- Location create/update accepts mappings only for active users in the
  authenticated account.
- User update ignores client attempts to replace `_id`, `account_id`, or
  `createdBy`; those values are restored from the scoped stored record.
- Observation create/update ignores client-owned tenant/audit fields, requires
  referenced assets and locations to belong to the authenticated account, and
  tenant-scopes the update write itself.
- Procedures validate every referenced location, asset, and inventory part
  against the authenticated account before creating a version. Work-order
  templates apply the same rule to procedures, assignees, locations, assets,
  and parts before create/update.
- Work instructions, troubleshoot guides, SOPs, and form categories pin
  update/delete writes to the authenticated account. Knowledge resource
  references are tenant-validated, and writes require an existing asset or
  location edit grant; SOP/category writes retain their existing form grants.
- Asset and equipment create/update/copy flows validate referenced locations,
  assets, source entities, and active assignees within the authenticated
  account before mutation or mapping access.
- Asset and sensor filters may only narrow a non-admin user's mapped asset set;
  requested identifiers can no longer replace or expand that server-derived
  scope. Buzzer mutation additionally requires `asset.config_alarm`, validates
  the exact queried identifier set and boolean values, and pins every bulk
  update to the authenticated account and visible asset.
- Asset-report mutations validate asset and location ownership, tenant-scope
  every write, and keep optional work-order creation in the same transaction.
- Asset-report PDF reads require the report to belong to the authenticated
  account before any report image or processor data is loaded.
- Asynchronous PDF jobs, status reads, generated objects, and signed downloads
  are tenant-scoped. Chart snapshots require matching PNG/JPEG/SVG signatures;
  active SVG script, event-handler, and JavaScript URL content is rejected.
- Work-request list, count, single-record reads, updates, governance
  transitions, soft deletion, and work-order conversion reapply the
  authenticated tenant inside the reusable service boundary. Client updates
  cannot overwrite tenant, visibility, synchronization, creator, approval,
  rejection, conversion, or due-date ownership fields.
- Post reads, updates, reactions, and soft deletion reapply authenticated
  tenant and visibility scope at the service mutation boundary. Client post
  updates cannot replace tenant, creator, timestamps, identifiers, populated
  users, or location projections. Post-comment list/read/create/update/delete
  and recursive reply deletion require the route post and every comment or
  parent comment to belong to the same authenticated tenant.
- Work-order comments require the existing comment grant, validate the parent
  work order and optional parent comment inside the authenticated tenant, and
  include tenant plus work-order ownership in update/delete and recursive
  soft-delete filters.
- Company update/image/delete routes require existing user-administration
  grants. Company deletion rejects any identifier other than the authenticated
  account and repeats that account check inside the service boundary.
- Role list/read/create/update/delete operations are guarded by the existing
  `permission` grants. Role creation verifies the target user belongs to the
  authenticated account, update/delete writes include the account in the
  atomic model filter, and clients cannot replace tenant, target-user,
  role-menu, creator, or audit ownership. Requested grants cannot exceed the
  acting user's effective permission data.
- User-to-asset assignment writes require the existing `asset.edit_asset`
  grant and validate every asset and user against the authenticated account.
  Asset-mail preference writes require `asset_mail.edit`, resolve every
  mapping ID first, validate both sides of each mapping, and pin bulk-update
  filters to the validated mapping, asset, and user.
- User-to-location reads first resolve tenant-owned locations and, for
  non-admin callers, intersect them with the caller's mapped location set.
  Mapping writes require `location.edit_location` and validate every target
  location and active user against the authenticated account before replacing
  mappings. Location copy and floor-map image mutation retain their existing
  location grants, while floor-map coordinate creation requires
  `floorMap.create_kpi`.
- Legacy mutations for work requests, inspections, preventive schedules,
  inventory and part types, posts/comments, tenant users, work orders,
  assignments, procedures/templates, observations, company settings, knowledge
  resources, and asset-report PDF generation now fail closed through existing
  role-menu grants without changing their paths or payloads.
- Processor jobs contain entity identifiers only. Workers use
  `PROCESSOR_API_TOKEN` from centralized runtime configuration instead of
  persisting or replaying a user's CMMS bearer token.
- The legacy external-token bootstrap route retains its path and response but
  now requires a constant-time validated `X-CMMS-Processor-Token`; knowing an
  active user's email can no longer mint a login token.
- Payload session keys are sealed into opaque AES-256-GCM key identifiers for
  cross-instance recovery, and nonce replay is atomically denied in Redis.
- Metrics require a distinct production bearer credential. Access, external,
  refresh, payload-sealing, mail, and metrics secrets fail startup validation
  when missing or insecure.
- Non-admin audit-log reads remain pinned to the authenticated user even when
  a different query `userId` is supplied; administrators remain tenant-pinned.
