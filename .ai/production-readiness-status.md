# Production Readiness Status

Date: 2026-08-03

The repository-local production-readiness foundation is implemented for the
approved scope, but the complete plan is **not yet production-certified**. Cloud
resource application, named governance approvals, seeded authenticated
end-to-end coverage, the planned 60% repository coverage baseline across every
metric,
load/failover/restore evidence, and operational soak data remain release gates.

| Gate | Status | Current evidence | Remaining blocker |
|---|---|---|---|
| G0 Baseline | Implemented, review required | handbook, ADRs, 305-declaration route/OpenAPI baselines, module/risk/backlog registers | named individual owners and approval |
| G1 Safety net | Implemented, below target | deterministic locks; API 847 domain/runtime, 11 deployment, and 4 capacity-tooling tests; replica-set rollback; APP 601 unit, 11 deployment-tooling, and 6 Playwright tests; CI coverage/SAST/DAST/secret/license/audit/SBOM/provenance/Terraform gates | API repository coverage is 60.89% statements/61.50% lines/62.60% functions but 50.52% branches; APP is 24.26% statements/24.48% lines versus the planned initial 60%; seeded real-backend CRUD journeys remain |
| G2 Runtime controls | Implemented locally | centralized fail-fast config, request/trace propagation, redacted Pino logs, protected Prometheus, OTLP traces/metrics, bounded Mongo/Redis/queue/storage readiness, explicit socket/auth/upload/scheduler/worker metrics, `autoIndex=false`, 43-model manifest and create-only migration, provider-validated encrypted CloudWatch sinks/dashboard/alarms | apply sinks, prove alert delivery/trace search, and retain query-plan evidence |
| G3 State externalization | Implemented foundation | Redis limiter/socket adapter, transaction-aware outbox writer, exact-version BullMQ consumer registry, idempotent email and notification producers, tenant-scoped observation/asset/equipment/asset-report processor workers, additive tenant-scoped asynchronous PDF jobs with verified snapshots/private signed downloads/retention, bounded retry/dead-letter/redrive, private S3 driver, content/malware gates, tenant-owned checksum metadata, atomic tenant quota reservations, versioned indexes, checksum/quota reconciliation, feature-flagged S3-first/local fallback, and tenant-checked S3 report-image reads | managed provisioning, staged file/quota reconciliation and cutover, fallback retirement, deployed operations dashboard, and two-instance proof |
| G4 HA release | Valid code, not applied | Terraform 1.15.8 validates two-AZ VPC/ALB/ASG, WAF, Redis, encrypted/versioned storage, CSP/security headers, encrypted process logs, ALB access evidence, dashboard/alarms/scaling, S3/CloudFront, CodeDeploy blue-green and rollback alarms; manual API/APP production workflows require immutable artifacts, staging soak, backup, database compatibility, rollback, change, and dependency-risk evidence; CI waits, smokes, ZAP-scans, promotes SPA entrypoints last, and retains evidence | backend state, environment values, approvals, apply, smoke/rollback rehearsal evidence |
| G5 Frozen APP runtime | Accepted exception | Angular 15.2.10, Material/CDK 14.2.7, TypeScript 4.9.5, Node 18 CI; exception expires 2026-10-26 | user approval is required before any framework modernization |
| G6 Certification | Blocked by measured and external gates | API audit 0; APP critical 0; local test/build gates pass | repository coverage targets, APP 22 reviewed findings (18 high, 3 moderate, 1 low), named approvals, load/failover/restore/incident/SLO evidence |

## Verified locally

- API: typecheck, 847/847 Vitest plus 11/11 deployment and 4/4 capacity-tooling tests, replica-set transaction rollback, 305 route
  declarations, OpenAPI 3.1 catalog, 319 response call-site contracts,
  43-model index manifest, production API/worker build, and zero audit findings.
- Enforced API runtime slice: 94.32% lines, 93.65% statements, 96.60%
  functions, and 81.30% branches, with 93%/94%/96%/81% global and sensitive
  90%+ gates. The non-excluding repository measurement is 61.50% lines, 60.89%
  statements, 62.60% functions, and 50.52% branches with matching ratchets;
  statement, line, and function baselines now exceed 60%, while branch
  coverage remains below the initial 60% target. The expanded measured scope now
  includes access-token middleware, inspection
  tenant/transaction controls, upload tenant-context enforcement, tenant-safe
  notification test delivery, sealed cross-instance payload keys, distributed
  nonce replay denial, processor-only external-token bootstrap, reusable RBAC,
  self-pinned audit-log access, 90%-gated tenant-scoped idempotency with
  disk-backed multipart hashing, the storage boundary at 100%
  statements/lines/functions plus 92.45% branches, tenant upload
  metadata/quota accounting, reconciliation, and the readiness/metrics
  boundary at 100% statements/lines/functions plus 94.28% branches with
  structured timeout/rejection degradation, and
  versioned index migrations plus the legacy work-request, work-order assignee,
  observation, asset, equipment, asset-report processor-event boundaries, and
  the asynchronous PDF job lifecycle, tenant-owned work-request service
  mutations, protected lifecycle fields, and work-order assignment reads.
  Public registration, account-verification, and password-reset controllers
  also have dedicated contract/denial tests; password changes consume a
  one-time authorization established only by verification of the exact current
  OTP, and new OTP issuance invalidates stale records.
  App-managed transactions explicitly use primary read preference, and the
  history plugin applies the same primary rule to pre-image and work-order
  assignment snapshots while retaining failure containment for main writes.
  Notification Socket.IO handshakes now reject cross-tenant account/JWT pairs;
  Redis adapter startup/shutdown, verified user rooms, acknowledgements, and
  disconnect metrics have a dedicated 100%-covered regression suite.
  Mongo pooled connection, managed/constructed URI, credentials, failure, and
  recursive lean-result normalization paths are fully covered. API and worker
  startup/shutdown functions are 97%+ covered and serialize repeated signal
  cleanup through one promise rather than racing teardown.
  Post and nested post-comment boundaries now tenant-scope every read/mutation,
  protect stored ownership fields, validate parent/post ownership, and enforce
  98–100% line coverage with reviewed branch gates.
  Role administration enforces the existing grants, prevents assignments
  above the actor's effective permission ceiling, protects tenant/user/menu
  ownership fields, and uses account-scoped writes. User-to-asset mutations
  validate every asset, user, and mail-preference mapping against the
  authenticated account before writing.
  Asset list/sensor filters now intersect caller-supplied identifiers with the
  authenticated user's mapped assets, and buzzer writes require
  `asset.config_alarm`, exact queried identifiers, tenant-pinned bulk filters,
  and boolean values.
  User-to-location reads are tenant-scoped and intersect non-admin callers with
  their mapped locations. Mapping mutations require `location.edit_location`
  and validate every location and active user against the authenticated tenant;
  floor-map coordinate creation and location copy/image mutations now enforce
  their existing role permissions.
  Company deletion, work-order comments, procedures, work-order templates,
  instructions, troubleshoot guides, SOPs, and form categories now reapply
  authenticated tenant ownership at reusable mutation boundaries. Existing
  permission keys guard company, work-request, inspection, preventive,
  inventory, post/comment, user, work-order, procedure/template, observation,
  knowledge, report-PDF, and assignment mutations.
  Inventory parts now add 35 behavior/transaction tests and enforce 96.78%
  statements, 97.74% lines, 100% functions, and 81.41% branches across stock
  reservation/issue/return, transfer, cycle-count, replenishment, history,
  optimistic-update, invalid lifecycle, reopening, and failure paths. Equipment subtype creation/update and tenant
  boundaries enforce 87.89% statements, 90.43% lines, 86.88% functions, and
  75.54% branches.
- APP: deterministic install; frozen Angular 15.2.10, Material/CDK 14.2.7, and
  TypeScript 4.9.5; 601/601 Angular and 11/11 deployment-tooling tests;
  production build with `/cmms/` base href; 6/6 Playwright
  functional/accessibility/visual journeys,
  including a mocked login-to-protected-route contract;
  88 registered primary login/logout/refresh/schedule/work-order/dashboard/
  SOP/form-category/location/floor-map/procedure/instruction/troubleshoot/
  report/equipment/company/asset-report-PDF/notification/user-administration/
  work-order-template/parts/observation/inspection/work-request compatibility
  contracts,
  including all 8 public registration, verification, and password-recovery
  contracts through one typed lifecycle service and typed post/upload/reaction/
  nested-comment ownership with encoded identifiers,
  primary-client exclusion of ML chatbot/document traffic, and dedicated ML
  transport authentication/query/encoding isolation; typed asset list/detail/
  tree/child/copy/legacy-mutation/sensor/filter/buzzer/upload ownership across
  31 callers; typed location tree/list/child/sensor/upload/floor-map/user-mapping
  ownership across all current callers; typed administration
  ownership for user roles and asset-mail preferences; notification-only
  Socket.IO behavior; service-worker API exclusion; no executable inline
  entrypoint scripts; 3,296,473-byte initial bundle; license and
  SBOM gates; repository coverage of 24.26% statements, 24.48% lines, 22.41%
  functions, and 14.58% branches; the high-volume asset-report editor is
  independently ratcheted at 40% statements/lines/functions and 20% branches,
  while work-order creation is gated at 75% statements/lines/functions and 60%
  branches, the bulk work-order wizard at 90%/70%, and pump fleet overview at
  95%/85%;
  22 reviewed production findings (zero
  critical, 18 high, 3 moderate, and 1 low) under an expiring exception that
  still requires named approval for release.
- Terraform 1.15.8: format, initialization, and provider-backed validation succeeded.
- Neither repository's tracked `tsconfig.json` was changed.

## Blast radius of the implemented changes

- Web: auth destination boundaries, feature-flagged refresh-cookie transport,
  dependency and CI/test tooling; no UI, Bootstrap structure, route,
  translation, or CSS redesign.
- API: configuration, startup/shutdown, CORS, health/metrics, request context,
  storage/upload, distributed rate limits, sockets, queue/outbox, tests, and
  deployment packaging.
- Mobile/external: no implementation exists; existing API paths, methods,
  payloads, bearer/account headers, payload-crypto headers, and socket event
  names remain unchanged.
- Data: production index default plus outbox, tenant upload-metadata, quota
  ledger, quota-reservation, and PDF-job collections; the compiled idempotent
  migration runner was tested against ephemeral MongoDB only, with no
  destructive or production migration.
- Operations: CI, executable CodeDeploy hooks (including the pre-start index
  migration), PM2 API/worker topology, WAF and Terraform were changed; no cloud
  resource or production deployment was executed.
