# Testing and Quality Gates

## Required layers

- API unit tests for domain services, validators, policies, crypto, and transaction helpers.
- Supertest integration tests against an ephemeral MongoDB replica set.
- Contract tests that fail on route/method or response-shape drift.
- Angular unit tests plus Playwright for critical user journeys.
- Tenant-escape, RBAC, replay, malformed upload, offline/session-separation, accessibility, and visual-regression tests.
- Resilience and restore exercises in staging.

Coverage gates are 80% changed code, 90% authentication/authorization/transaction code, and an initial 60% repository baseline that ratchets toward 80%. A passing percentage never replaces required behavior and denial-path tests.

Critical journeys cover registration, verification, login/refresh/logout, RBAC, users, locations, assets, inspections, work requests/orders, inventory, schedules, reports, notifications, uploads, and payload encryption.

## Machine-enforced compatibility baselines

- 305 route declarations are hashed by `check:api-contract`.
- 305 operations are cataloged in OpenAPI 3.1 by `check:openapi`.
- 319 Express response call sites, status codes, payload kinds, object keys and
  call hashes are checked by `check:response-contracts`; source line movement
  is retained as evidence but excluded from semantic compatibility comparison.
- 43 Mongoose model index definitions are checked by `check:index-manifest`.
- Work-order, assignee, work-request, inspection, location, user, observation,
  asset, equipment, asset-report, and processor transaction/outbox boundaries
  are checked by `check:domain-outbox`.

The current suite has 847 tests. Its expanded controlled runtime slice has
93.65% statements, 94.32% lines, 96.60% functions, and 81.30% branches and is
independently gated at 93% statements, 94% lines, 96% functions, and 81%
branches.
Core authentication, refresh-cookie authentication, the inspection and
work-order assignment transaction controllers, the tenant-owned work-request
service, the upload tenant boundary, and tenant-safe notification test delivery
additionally enforce sensitive-path statement, line, and function thresholds of
at least 90%, with reviewed branch floors. The idempotency middleware enforces
90% on statements, lines, functions, and branches and covers tenant/user scope,
replay conflicts, processing leases, persistence races, response finalization,
and memory- plus disk-backed multipart fingerprints.
The local/S3/dual-read storage boundary independently enforces 90% statements,
lines, and functions plus 80% branches; its current result is 100% statements,
lines, and functions with 92.45% branches.
Payload encryption, processor-only token bootstrap, and reusable RBAC
middleware now have dedicated sensitive-path thresholds. Payload crypto is
99%+ statements/lines, 100% functions, and 90.83% branches; processor
authentication and RBAC are fully covered at their configured gates.
The readiness/metrics boundary independently enforces 95% statements, lines,
and functions plus 90% branches; it currently has 100% statements, lines, and
functions with 96.07% branches and converts rejected or timed-out dependency
probes into structured degraded readiness.
Registration, account verification, password-reset controllers, and the
password-reset authorization service have dedicated success and denial-path
tests. Password changes require an atomically consumed authorization created
only by successful verification of the exact current OTP; requesting another
code invalidates prior codes and authorizations.
Post and nested post-comment controllers/services have dedicated cross-tenant,
protected-field, recursive-reply, reaction, success, and failure coverage.
Post controllers currently enforce 98.94% lines and 97.91% branches; the post
service has 100% statements/lines/functions, while the comment boundary has
100% statements/lines/functions and at least 90% branches. Per-file sensitive
thresholds prevent those tenant controls from regressing.
Schedule reads tolerate legacy non-ObjectId part types while enriching valid
references, and update/delete writes reapply visible tenant ownership in the
service filter. The schedule service is independently gated at 100% statements,
lines, and functions plus 90% branches.
Procedure behavior tests preserve current/latest and history reads, normalized
tenant-owned references, immutable version creation, tenant-pinned version-group
supersession/deletion, inventory enrichment, and legacy-record fallbacks. The
procedure service is independently gated at 100% statements/lines/functions and
84.29% branches.
The unified scheduler has deterministic date, repetition, weekend/skip-date,
once-per-day, distributed-lock ownership, recurrence-date, and failure-isolation
coverage. A missing work-order result now fails closed without advancing or
saving the schedule. The service is gated at 100% statements/lines/functions
and 96.61% branches.
Transaction and audit-history tests enforce primary read preference both when
starting app-managed transactions and on every pre-image/assignee snapshot
query. They cover commit, abort, unsupported-deployment fallback, bulk and save
hooks, work-order actor repair, assignment lookup degradation, and middleware
failure containment. History is gated at 90%+ statements/lines and 81.03%
branches; the transaction helper has 93.75% statements and 95.55% lines.
Notification Socket.IO authentication rejects any handshake whose verified JWT
tenant differs from the supplied account, and its Redis adapter, user-room,
acknowledgement, disconnect, and shutdown lifecycle is gated at 100% coverage.
Mongo connection URI construction, credential encoding, managed URI selection,
pool reuse, lifecycle events, fatal connection failure, recursive lean-result ID
normalization, and the database facade are gated at 100% statements/lines/functions.
API and worker entrypoints now expose testable lifecycle functions, share one
shutdown promise across repeated signals, preserve bounded forced termination,
and enforce 95%+ statements/lines plus 100% function coverage.
Work-order, equipment, and inventory-parts controllers now have direct contract
coverage for tenant/user scoping, pagination, synchronization versions, child
asset lifecycle, queue-disabled fallbacks, uploads, stock transfer, cycle
counts, and error containment. Each controller enforces 85-90% statements and
lines, 100% functions, and reviewed 65-70% branch floors.
Role administration has dedicated tenant, protected-field, permission-ceiling,
success, and denial coverage and currently enforces 94.17% statements/lines,
100% functions, and 91.07% branches across its controller/service boundary.
The user-to-asset controller covers self-only reads, tenant asset/user checks,
mapping-ID validation, and mail-flag write pinning at 98.83% statements,
98.70% lines, 100% functions, and 84.44% branches.
Asset controller/service denial tests verify non-admin list and sensor
intersection, exact buzzer identifier matching, boolean validation, tenant
pinning, and fail-closed bulk writes outside the authorized asset set. The
user-to-location controller and route tests verify tenant-scoped reads,
non-admin location intersection, active tenant-user and location validation,
permission guards for mapping mutations, location copy/floor-image mutation,
and floor-map coordinate creation. Mutation-route tests additionally deny
missing grants for work requests, inspections, schedules, inventory, posts and
post comments, users, work orders and assignments, procedures/templates,
observations, knowledge resources, companies, and report-PDF generation.
Reusable tenant-reference tests cover individual and set-based references;
company and work-order-comment service tests prove account-pinned writes,
parent-work-order ownership, and tenant-pinned recursive deletion. The
production configuration subprocess tests use an explicit 20-second bound so
process startup contention cannot create false five-second failures.
Inventory branch suites additionally cover invalid lifecycle quantities,
transactional stock validation, every stock-adjustment failure family, legacy
allocation reversion, in-progress/completed/reopened inventory movement paths,
exact and zero-stock cycle counts, unchanged approvals, and replenishment
ranking. The parts service is independently gated at 95% statements/lines,
100% functions, and 80% branches.
The separate whole-repository configuration measures every executable
`src/**/*.ts` file and currently reports 60.89% statements, 50.52% branches,
62.60% functions, and 61.50% lines. CI ratchets those values at 60.80%, 50.50%,
62.60%, and 61.40% respectively. Statement, line, and function coverage exceed
the initial 60% enterprise target; seeded integration coverage for remaining
legacy decision paths is still required to raise branches from 50.52% to 60%.
