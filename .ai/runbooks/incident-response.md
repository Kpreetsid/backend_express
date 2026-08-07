# Production Incident Response

## Trigger and ownership

Open an incident when the availability/error SLO burns, readiness removes safe
capacity, authentication anomalies spike, queue lag threatens delivery, a
tenant-boundary concern is reported, or data integrity is uncertain. Assign an
incident commander, operations lead, communications lead, and scribe. Record
named people in the incident system; repository role names are not substitutes.

Classify tenant isolation, credential exposure, unauthorized file access, or
audit-log integrity as security incidents. Preserve logs and access evidence
before changing retention or credentials.

## First 15 minutes

1. Record start time, deployment SHA, affected tenant(s), regions/AZs, symptoms,
   and the alert that opened the incident.
2. Check ALB healthy targets and 5xx/p95 alarms, `/health/live`,
   `/health/ready`, protected `/metrics`, API/worker structured logs, MongoDB,
   Redis and BullMQ dashboards.
3. Stop forward deployment. Do not delete queue jobs, files, indexes, or audit
   records during diagnosis.
4. If the latest release is implicated, invoke the authorized immutable
   rollback workflow. Record the change/incident ID and CodeDeploy result.
5. If tenant isolation may be affected, disable the unsafe route or remove
   traffic before attempting data repair. Rotate exposed credentials through
   Secrets Manager and KMS procedures.

## Stabilization choices

- API capacity: let Auto Scaling replace unhealthy targets; do not compile or
  patch TypeScript on an instance.
- MongoDB: keep writes disabled if majority durability or tenant integrity is
  uncertain. Follow `mongo-restore.md` for recovery.
- Redis: business data remains authoritative in MongoDB/S3. Follow
  `redis-and-queue-failover.md`; never flush production Redis as a diagnostic.
- Uploads: keep S3/local fallback flags unchanged until reconciliation proves
  which copy is authoritative. Follow `upload-cutover.md`.
- Notifications: Socket.IO remains notification-only. Queue lag can delay
  delivery but must not be worked around with untracked direct database writes.

## Resolution evidence

Retain the incident timeline, alerts, redacted log/trace queries, deployment or
rollback IDs, affected tenants, data validation, customer communications,
recovery time, measured data-loss window, and follow-up owners. Complete a
postmortem for SEV-1/SEV-2 events and test every corrective action.
