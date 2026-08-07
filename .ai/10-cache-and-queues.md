# Redis, Cache, and Queue Standard

Managed Redis is required before more than one API or worker instance is enabled.

Initial Redis uses are distributed rate limiting, Socket.IO adapter state, short-lived locks, and BullMQ coordination. Redis cache loss must not lose business data.

Keys use:

`cmms:{environment}:{tenant}:{domain}:{identifier}`

Every key family has a registered owner, TTL, cardinality bound, invalidation rule, privacy classification, timeout, retry policy, and explicit fail-open/fail-closed decision.

Jobs use versioned envelopes with event ID, type, version, tenant ID, actor ID, correlation ID, entity reference, timestamp, and payload. Workers implement bounded exponential retries, idempotency/deduplication, dead-letter handling, concurrency limits, and queue-lag alerts. A MongoDB outbox connects committed mutations to jobs.

`createOutboxEvent` is the transaction-aware producer boundary. Domain services
must pass the same MongoDB `ClientSession` used by their business mutation so
the mutation and event are atomic. The writer validates required tenant,
correlation, entity, type, and version fields before persistence. Migrating
legacy synchronous domain side effects to this boundary remains incremental;
no existing API behavior is removed during that migration.

The outbox defaults to 10 delivery attempts and is configured centrally with
`OUTBOX_MAX_ATTEMPTS`. Exhausted records enter the terminal `dead-letter`
state and increment `cmms_outbox_dead_letter_total`. Operators may redrive one
tenant-scoped event explicitly:

```powershell
npm run outbox:redrive -- --event-id <event-id> --tenant-id <tenant-id>
```

Readiness queries BullMQ with a bounded timeout. `cmms_queue_ready` and
`cmms_queue_jobs{state}` expose queue availability and waiting, active, delayed,
and failed job counts.

The worker consumes the `domain-events` queue through an exact `type@version`
handler registry. Unknown versions fail explicitly and use BullMQ retry/dead
letter behavior instead of being silently discarded. Configure bounded
parallelism with `QUEUE_WORKER_CONCURRENCY` (default `10`).

`DOMAIN_EVENT_OUTBOX_ENABLED` defaults to the value of `QUEUE_ENABLED`. Set it
to `false` only as a temporary rollback switch. It cannot be enabled while the
queue is disabled, and production startup rejects disabling it.

Work-order assignment email uses `email.work-order.assigned@1`. The event stores
tenant-scoped entity identifiers rather than rendered email bodies. The worker
reloads the work order, recipient, and actor within the envelope tenant and
uses a deterministic SMTP message ID plus the mail log to suppress successful
BullMQ retries.

User creation now commits the user, role mapping,
`email.user.created@1`, and `notification.account.requested@1` within one
MongoDB transaction. The worker reloads the new user through the envelope
tenant and uses a deterministic SMTP message ID. Queue-disabled development
keeps the prior synchronous email and notification behavior.

Work-request create, update, approve, and reject now commit the mutation and
`notification.account.requested@1` in the same MongoDB transaction. The event
tenant always comes from the authenticated user, never from request body data.
Replica-set integration tests prove both commit and rollback, and controller
tests cover detached Express handlers and outbox failure behavior. Existing
routes, response shapes, and notification socket event names are unchanged.

The legacy work-order assignee mapping endpoint now uses its documented
`workOrderId` plus `userIdList` body, validates the work order and every active
assignee against the authenticated account, and commits create/update mappings
with the same notification event transaction. Cross-tenant mapped-data reads
and deletes are denied before the mapping collection is accessed.

Inspection create/update, location create/update, and user update now use the
same transaction-aware notification boundary. Location mutations validate all
selected assignees through the shared active-tenant-user guard before location
or mapping writes. User updates force `_id`, `account_id`, and `createdBy` from
the stored authenticated-tenant record. The only direct user-create
notification left in this controller is the intentional queue-disabled
development rollback path; production cannot disable the outbox.

Observation create/update now commits the mutation,
`processor.asset-health.observation-upserted@1`, and
`notification.account.requested@1` in one MongoDB transaction. The event stores
only the observation identifier. Its worker reloads the latest visible
observation through the envelope tenant and calls the processor with the
centrally configured service credential, never the request bearer token.
Retries therefore converge on current state; an observation deleted before
delivery is an idempotent no-op.

Asset create/update commits mappings, notification events, and
`processor.asset-health.assets-initialize@1` atomically. Hierarchy-copy
operations additionally emit `processor.asset-endpoints.asset-cloned@1` for
each copied asset. Equipment create/update/image changes use the same
transaction boundary and emit `processor.equipment-endpoints.synchronize@1`
plus asset-health initialization where required.

Asset-report create/update/complete/delete emits
`processor.asset-report.synchronize@1` in the report transaction. Its worker
reloads current tenant state and performs health synchronization, alarm-history
updates, and freeze/unfreeze decisions. All processor workers use the
centrally configured service credential and deterministic idempotency keys;
no user bearer token is stored in an outbox record or replayed by a worker.

The existing asset-report PDF endpoint remains synchronous because its binary
HTTP response is an immutable compatibility contract. It is tenant-scoped and
uses the processor service credential. Heavy generation is also available
through the additive `report.asset-pdf.generate@1` lifecycle: request creation
commits a tenant-owned PDF job and outbox event atomically, the worker reloads
the report through the envelope tenant, verifies stored chart checksums and
signatures, generates the PDF with the processor service credential, and
stores it under a private tenant/job prefix. Status and short-lived signed
download routes never expose another tenant's job. Input snapshots expire
after two days, generated PDFs after eight days, and job records after the
configured seven-day retention.
