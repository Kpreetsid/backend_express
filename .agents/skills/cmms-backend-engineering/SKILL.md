---
name: cmms-backend-engineering
description: "Use when exploring, planning or coordinating engineering work across the Express/TypeScript CMMS_API backend. Not for frontend-only tasks."
---

# CMMS backend engineering

Apply these instructions to the **current checked-out repository branch**, not a remembered branch. Read repository-root `AGENTS.md` and the affected scoped guides when present. In a cross-project CMMS-Production task, also read the workspace and frontend guides explicitly; a standalone API clone does not require them. Bundled references remain usable with this skill outside the repository, but their snapshots never replace current source. Scale the procedure to the request: for read-only review inspect and report rather than edit; instruction-only work uses static metadata/link/reference/whitespace checks rather than runtime tests.

## Procedure

1. Inspect active branch, HEAD, dirty state and `package.json`; load [branch truth](references/branch-truth.md), then the affected files. Do not assume the inspected snapshot is current.
2. Trace full route -> auth/permission/validation middleware -> controller -> service -> Mongoose model -> side effects -> response. Load [architecture](references/architecture.md) as needed.
3. State scope, tenant identity, user permissions, exact API contract and acceptance tests; select [feature playbook](references/feature-playbook.md) or [standards](references/coding-standards.md) for implementation work.
4. Implement minimal branch-compatible changes; keep secrets out of logs/diffs, preserve account predicates, model references, soft deletes, enums and error response shape. Load [auth](references/auth-rbac-security.md) / [data](references/data-mongoose.md) for risk areas.
5. Verify affected behavior with relevant success/error/wrong-tenant tests when implementing runtime changes; isolate dependencies and avoid SMTP/production. For docs-only work use static documentation checks. Run only scripts present on the active branch after checking tool prerequisites; use [testing](references/testing.md).
6. Follow [review checklist](references/review-checklist.md), then report changed paths, commands and `PASS/FAIL/NOT RUN`, unverified gaps, and any requested actions not performed.

## Completion contract

Report inspected branch/commit, changed paths or findings, relevant contract/data/auth impact, actual checks with `PASS/FAIL/NOT RUN`, and material unresolved decisions. Include affected methods/routes/models only when applicable. Do not invent an endpoint exercise for a docs-only task or imply a push, deployment, test execution or API verification without evidence.

## Reference material

Load only what this task needs:

- [ARCHITECTURE.md](references/architecture.md)

- [AUTH-RBAC-SECURITY.md](references/auth-rbac-security.md)

- [BRANCH-TRUTH.md](references/branch-truth.md)

- [CODING-STANDARDS.md](references/coding-standards.md)

- [CONTEXT7-NOTES.md](references/context7-notes.md)

- [DATA-MONGOOSE.md](references/data-mongoose.md)

- [FEATURE-PLAYBOOK.md](references/feature-playbook.md)

- [REVIEW-CHECKLIST.md](references/review-checklist.md)

- [SOURCE-MAP.md](references/source-map.md)

- [TESTING.md](references/testing.md)
