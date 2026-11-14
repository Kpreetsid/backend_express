# Presage Four-App Suite - Codex Knowledge Base

> Local installation: read [CURRENT-WORKSPACE.md](CURRENT-WORKSPACE.md) first. This downloaded document describes inspected remote branch snapshots; current local source, package scripts and owning AGENTS.md take precedence. Paths and security controls below must be re-traced on the active branch.

**Inspection snapshot:** 2026-11-12. Inspected GitHub trees and representative route, service, security, configuration, and test files. All capability statements describe *repository evidence*, not verified production behavior.

## Local entry point

Read [CURRENT-WORKSPACE.md](CURRENT-WORKSPACE.md) for local folder aliases, current layouts, commands, known contract drift and existing skill routing. The following index is the downloaded remote snapshot.

## Routing and maintenance

Use [skill ownership](SKILL-ROUTING.md) to select one coordinator and the owning project specialists. See the root workspace `docs/ai-suite/GUIDANCE-REVIEW.md` for the instruction audit and executed static checks.

## First read order

1. [REPOSITORIES-AND-BRANCHES.md](REPOSITORIES-AND-BRANCHES.md) - locate active branch, framework, source roots.
2. [FEATURE-MATRIX.md](FEATURE-MATRIX.md) - integrated feature inventory, owners, and overlap.
3. [OWNERSHIP-AND-BOUNDARIES.md](OWNERSHIP-AND-BOUNDARIES.md) - select repo that actually owns change.
4. [MODULE-INVENTORY.md](MODULE-INVENTORY.md) - locate application modules by domain.
5. [API-CONTRACT-MAP.md](API-CONTRACT-MAP.md) - route prefix, consumers, headers, response shape.
6. [SECURITY-AND-TENANCY.md](SECURITY-AND-TENANCY.md) - guardrail before cross-project work.
7. [END-TO-END-WORKFLOWS.md](END-TO-END-WORKFLOWS.md) - trace request across apps.
8. [TESTING-AND-VALIDATION.md](TESTING-AND-VALIDATION.md) - branch-specific commands and proof requirements.
9. [SOURCE-MAP.md](SOURCE-MAP.md) - immutable source file links used in this knowledge base.

## Detailed playbooks

- [AUTH-AND-ACCESS.md](AUTH-AND-ACCESS.md) - sessions, identity, permissions, account membership.
- [EMAIL-AND-SUPPORT-LOGIN.md](EMAIL-AND-SUPPORT-LOGIN.md) - two separate login-link systems.
- [KNOWLEDGE-BASE.md](KNOWLEDGE-BASE.md) - publishing versus viewing ownership.
- [CMMS-OPERATIONS.md](CMMS-OPERATIONS.md) - assets, orders, maintenance, schedules.
- [INTERNAL-OPERATIONS.md](INTERNAL-OPERATIONS.md) - staff/CRM/account modules.
- [PWA-OFFLINE-NOTIFICATIONS.md](PWA-OFFLINE-NOTIFICATIONS.md) - offline, notification, update risks.
- [FILES-AND-REPORTS.md](FILES-AND-REPORTS.md) - upload/download/report file boundaries.
- [INTEGRATIONS-AND-DATA.md](INTEGRATIONS-AND-DATA.md) - external processors, DB, caching, scheduled jobs.
- [ERROR-CONTRACT.md](ERROR-CONTRACT.md) - error status, UI messaging and retries.
- [CHANGE-RUNBOOK.md](CHANGE-RUNBOOK.md) - safe cross-repo change workflow.
- [RELEASE-AND-ROLLBACK.md](RELEASE-AND-ROLLBACK.md) - release sequencing.
- [CODEX-TASK-TEMPLATE.md](CODEX-TASK-TEMPLATE.md) - reusable task format.
- [KNOWN-GAPS.md](KNOWN-GAPS.md) - hypotheses and unresolved compatibility questions.

## Scope

The suite consists of `cmmsF`, `backend_express`, `presageInternal`, and `Internal_ExpressJS`. The names are repository identifiers, not necessarily deployed service names. Each repo may be checked out alone or as a sibling in a parent folder. Codex must verify branch, package scripts, routes, and security middleware in the current checkout before using this snapshot.
