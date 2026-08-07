# Redis and Queue Failover

## Expected behavior

Redis loss must not lose business data. MongoDB/S3 remain authoritative.
Production readiness fails when required queue coordination is unavailable;
payload replay protection fails closed. Notification sockets reconnect through
the ALB and Redis adapter after service recovery.

## Procedure

1. Record Redis primary/replica state, failover event, queue depth by state,
   outbox unpublished count, worker saturation, socket connections, API error
   rate, and deployment SHA.
2. Confirm the managed service initiated or completed replica promotion. Do
   not run `FLUSHALL`, delete BullMQ keys, or change the registered key prefix.
3. Confirm `/health/ready` removes unsafe targets and `/health/live` remains
   process-only. Verify payload-crypto replay requests continue failing closed.
4. After Redis is available, confirm workers reconnect, queue depth decreases,
   failed jobs remain inspectable, and outbox publication resumes.
5. Redrive only reviewed terminal outbox events with `npm run outbox:redrive`.
   Record event IDs and operator approval; do not redrive unknown event versions.
6. Verify duplicate email/notification/processor effects were prevented by
   event IDs and idempotent handlers. Verify Socket.IO rooms remain user scoped.

## Acceptance

No committed MongoDB mutation is lost, no duplicate external side effect is
observed, readiness transitions match dependency safety, queue lag returns to
its alert threshold, and notification clients reconnect. Retain provider
failover ID, metrics, redrive evidence, and measured recovery time.
