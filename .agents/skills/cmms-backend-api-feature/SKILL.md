---
name: cmms-backend-api-feature
description: "Use when adding or changing HTTP endpoints, validators, controllers, services or domain workflows in CMMS_API."
---

# Express API feature implementation

## Task mode and reference ownership

Resolve project paths and commands from this skill's owning repository root, even when the chat starts in CMMS-Production. Read the owning AGENTS.md and relevant scoped guides. Read-only reviews inspect and report without implementation; instruction-only changes use static metadata, link/path, reference-consistency and whitespace checks without app startup. Apply implementation and runtime-test steps below only to behavior changes. For local work prefer the corresponding canonical `docs/ai/` guide; bundled `references/` remain synchronized portable copies, not independent sources of truth.

Apply these instructions to the **current checked-out repository branch**, not a remembered branch. Read repository-root `AGENTS.md` and the affected scoped guides when present. In a cross-project CMMS-Production task, also read the workspace and frontend guides explicitly; a standalone API clone does not require them. Bundled references remain usable with this skill outside the repository, but their snapshots never replace current source. Scale the procedure to the request: for read-only review inspect and report rather than edit; instruction-only work uses static metadata/link/reference/whitespace checks rather than runtime tests.

## Procedure

1. Read [branch truth](references/branch-truth.md) and `src/app.ts` on the current checkout; map nested router mounts and middleware in exact order.
2. Inventory neighboring route/controller/service/model and Angular/API consumers for the requested contract; never guess an endpoint from service names.
3. Define payload, express-validator/ID validation, authentication, per-object permission, account scope, success envelope and error codes using [API contracts](references/api-contracts.md).
4. Add the smallest local-model/service/controller/route change in the established module; do not introduce another backend framework.
5. Exercise 400/401/403/404/409, invalid ID, wrong tenant, inconsistent state and concurrency scenarios. Follow [validation](references/error-validation.md) and [testing](references/testing.md).
6. Report exact method/path, changed files, check evidence and frontend contract impacts.

## Completion contract

Report inspected branch/commit, changed paths or findings, relevant contract/data/auth impact, actual checks with `PASS/FAIL/NOT RUN`, and material unresolved decisions. Include affected methods/routes/models only when applicable. Do not invent an endpoint exercise for a docs-only task or imply a push, deployment, test execution or API verification without evidence.

## Reference material

Load only what this task needs:

- [API-CONTRACTS.md](references/api-contracts.md)

- [BRANCH-TRUTH.md](references/branch-truth.md)

- [ERROR-VALIDATION.md](references/error-validation.md)

- [FEATURE-PLAYBOOK.md](references/feature-playbook.md)

- [TESTING.md](references/testing.md)
