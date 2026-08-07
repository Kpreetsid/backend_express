# MongoDB Restore and RPO/RTO Drill

## Safety constraints

Restore into a new isolated managed cluster. Never overwrite or drop the active
production cluster during a drill. Use private networking, the same encryption
class, majority write concern, and restricted restore credentials. Never copy
production secrets or payloads into CI artifacts.

## Drill procedure

1. Record incident/drill ID, latest confirmed point-in-time recovery timestamp,
   target recovery timestamp, source cluster, operator, and start time.
2. Restore the managed backup to a new cluster in the production network.
3. Apply the reviewed create-only index runner from the same API artifact. It
   must report all 43 registered model manifests without dropping indexes.
4. Start one isolated API/worker target against the restored cluster with
   outbound email, processors, schedules, and queue publication disabled.
5. Validate account/user/location/asset/work-request/work-order counts by
   tenant, audit/outbox continuity, upload metadata/checksums, quota ledgers,
   refresh-token revocation state, and representative high-volume queries.
6. Compare the newest durable business timestamp with the requested recovery
   point. Record measured RPO.
7. Exercise the documented connection-secret switch and target-group health
   checks without sending customer traffic. Record measured RTO.
8. Destroy the isolated restored cluster only after evidence is approved under
   the managed provider's recoverable deletion policy.

## Acceptance

- RPO is at most 15 minutes and RTO at most 60 minutes.
- No cross-tenant count or ownership discrepancy exists.
- Readiness is 503 until the restored dependencies can safely serve traffic.
- Index conflicts, outbox gaps, checksum differences, or audit discontinuity
  fail the drill and open corrective work.

Retain timestamps, provider backup/restore IDs, validation output, approvers,
and corrective actions; do not retain sensitive document contents.
