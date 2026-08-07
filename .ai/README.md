# CMMS AI Engineering Handbook

This directory is the canonical engineering source of truth for the CMMS
system composed of this `API` repository and the sibling `../APP` repository.
It documents the current system, target production controls, immutable
contracts, implementation gates, and evidence required for release.

## Authority

When guidance conflicts, use this precedence:

1. Security, tenant isolation, data durability, and API compatibility rules.
2. Approved architecture decision records (ADRs).
3. This handbook.
4. Existing module patterns.

Existing API paths, methods, payloads, response fields, status codes, bearer
authentication, `accountID`, payload-crypto headers, and notification socket
events are compatibility-protected. Breaking changes require a separately
approved versioned API.

## Handbook map

- `00-project-overview.md` - product, boundaries, goals, and SLOs.
- `01-architecture.md` - current and target system topology.
- `02-coding-standards.md` - TypeScript and implementation rules.
- `03-folder-structure.md` - ownership and dependency boundaries.
- `04-module-guidelines.md` - repeatable module blueprint.
- `05-api-standards.md` - immutable API and additive metadata rules.
- `06-security.md` - security baseline and SOC 2 evidence.
- `07-authentication.md` - login, token, refresh, CSRF, and RBAC flows.
- `08-database.md` - MongoDB durability, indexes, migrations, and tenancy.
- `09-performance.md` - budgets, profiling, and load acceptance.
- `10-cache-and-queues.md` - distributed state, BullMQ, and cache policy.
- `11-notifications.md` - database/email/socket delivery contract.
- `12-uploads.md` - local-to-S3 migration and validation.
- `13-observability.md` - logs, metrics, traces, health, and alerts.
- `14-error-handling.md` - stable errors and redaction.
- `15-testing.md` - test pyramid, CI gates, and coverage.
- `16-deployment.md` - artifacts, AWS HA, rollout, and rollback.
- `17-roadmap.md` - ordered implementation gates and exit criteria.
- `production-readiness-status.md` - verified evidence, blast radius, and current certification blockers.

Supporting evidence lives in `baselines/`, reusable documents in `templates/`,
ownership and risks in `registers/`, accepted decisions in `adr/`, and
executable operational procedures in `runbooks/`.

## Definition of handbook complete

- Every production control has an owner, implementation location, test, and
  evidence artifact.
- Every business module appears in the module matrix.
- Route and response baselines are reproducible by repository scripts.
- Risks have severity, mitigation, owner role, due gate, and acceptance status.
- An engineer can implement a roadmap item without choosing architecture.
