---
name: cmms-backend-auth-permissions
description: "Use when changing or reviewing CMMS_API login, two-step verification, sessions, JWTs, cookies, passwords, permissions or tenant isolation."
---

# Authentication, roles and tenant isolation

## Task mode and reference ownership

Resolve project paths and commands from this skill's owning repository root, even when the chat starts in CMMS-Production. Read the owning AGENTS.md and relevant scoped guides. Read-only reviews inspect and report without implementation; instruction-only changes use static metadata, link/path, reference-consistency and whitespace checks without app startup. Apply implementation and runtime-test steps below only to behavior changes. For local work prefer the corresponding canonical `docs/ai/` guide; bundled `references/` remain synchronized portable copies, not independent sources of truth.

Apply these instructions to the **current checked-out repository branch**, not a remembered branch. Read repository-root `AGENTS.md` and the affected scoped guides when present. In a cross-project CMMS-Production task, also read the workspace and frontend guides explicitly; a standalone API clone does not require them. Bundled references remain usable with this skill outside the repository, but their snapshots never replace current source. Scale the procedure to the request: for read-only review inspect and report rather than edit; instruction-only work uses static metadata/link/reference/whitespace checks rather than runtime tests.

## Procedure

1. Identify branch; read [auth security](references/auth-rbac-security.md) and trace all public/protected routes from the real router mounts.
2. Verify claims cryptographically (not `jwt.decode` alone), issuer/audience, expiry, revocation/session state, account/user binding, roles and object-level permissions.
3. Treat cookies, CSRF, CORS, password and email credentials as independent attack surfaces; inspect branch-specific middleware and configs.
4. Add tests for anonymous, wrong account, forbidden role, revoked/expired/modified tokens, session refresh, account switching, and any observable user enumeration.
5. Never print tokens, credentials, cookies, PII or private file paths; use fake test secrets and isolated DB.
6. Report source-based findings by severity, with proven vs unverified distinctions. Do not silently change token policy without requirements.

## Completion contract

Report inspected branch/commit, changed paths or findings, relevant contract/data/auth impact, actual checks with `PASS/FAIL/NOT RUN`, and material unresolved decisions. Include affected methods/routes/models only when applicable. Do not invent an endpoint exercise for a docs-only task or imply a push, deployment, test execution or API verification without evidence.

## Reference material

Load only what this task needs:

- [AUTH-RBAC-SECURITY.md](references/auth-rbac-security.md)

- [BRANCH-TRUTH.md](references/branch-truth.md)

- [EMAIL-LOGIN-TOKENS.md](references/email-login-tokens.md)

- [TESTING.md](references/testing.md)

For two-step changes, trace `src/user/two-step/` and `src/user/authentication/authentication.routes.ts`; preserve pending versus authenticated state, atomic consumption and session completion. Read the two-step section in the auth reference.
