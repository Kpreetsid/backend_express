# ADR-001: Preserve the modular monolith and externalize instance state

- Status: Accepted by implementation plan
- Date: 2026-07-28
- Owners: Platform architecture role; named approver required before production apply

## Context

The API and Angular application already share mature business contracts. Service decomposition would add migration and distributed-transaction risk without measured scaling or ownership evidence. Horizontal API scaling is blocked by local files and process-local coordination.

## Decision

Keep the API as a modular monolith. Move durable files to S3 and distributed coordination, Socket.IO adapter state, and queues to managed Redis. Run identical immutable API/worker artifacts across at least two availability zones behind an ALB using CodeDeploy blue-green.

## Compatibility and blast radius

No existing API or notification event changes. APP behavior and Bootstrap UI remain unchanged. MongoDB remains the business system of record; Redis loss cannot lose business data. External/mobile clients remain protected by contract tests.

## Validation

Two-instance tenant/RBAC/crypto/socket tests, S3 reconciliation, queue/outbox tests, load thresholds, failover, restore, and rollback evidence must pass before desired capacity exceeds one.

## Reversal

Return desired capacity to one, keep MongoDB authoritative, retain dual-read file fallback, and switch traffic to the prior blue target group.
