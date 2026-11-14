---
name: cmms-backend-email-login
description: "Use when working on CMMS_API email/support login credentials, issuance, inspection, exchange, revocation, expiry or deep links."
---

# Email login and support token flows

## Task mode and reference ownership

Resolve project paths and commands from this skill's owning repository root, even when the chat starts in CMMS-Production. Read the owning AGENTS.md and relevant scoped guides. Read-only reviews inspect and report without implementation; instruction-only changes use static metadata, link/path, reference-consistency and whitespace checks without app startup. Apply implementation and runtime-test steps below only to behavior changes. For local work prefer the corresponding canonical `docs/ai/` guide; bundled `references/` remain synchronized portable copies, not independent sources of truth.

Apply these instructions to the **current checked-out repository branch**, not a remembered branch. Read repository-root `AGENTS.md` and the affected scoped guides when present. In a cross-project CMMS-Production task, also read the workspace and frontend guides explicitly; a standalone API clone does not require them. Bundled references remain usable with this skill outside the repository, but their snapshots never replace current source. Scale the procedure to the request: for read-only review inspect and report rather than edit; instruction-only work uses static metadata/link/reference/whitespace checks rather than runtime tests.

## Procedure

1. Read [email login](references/email-login-tokens.md) and verify current branch and actual route registration. Resolve aliases through current app/non-auth routers; source tracing does not require a live server.
2. Map issuance, purpose/recipient/account binding, storage, delivery, inspect, exchange, session setup, redirect, expiry, rotation and revocation end to end.
3. Preserve distinct internal/support/external scopes and user-specific credential isolation; do not put token values in routes, logs, prompts or API examples.
4. Use current source and the user's explicit policy for TTL and repeated use before changing validity or consumption semantics; ask only when a material policy decision is missing.
5. Test invalid/expired/revoked/tampered/wrong-user/cross-tenant/replayed credentials and concurrent exchange; use mocked mail and test DB.
6. Report contract of both backend and consumer frontend, test evidence and any gaps in token-policy verification.

## Completion contract

Report inspected branch/commit, changed paths or findings, relevant contract/data/auth impact, actual checks with `PASS/FAIL/NOT RUN`, and material unresolved decisions. Include affected methods/routes/models only when applicable. Do not invent an endpoint exercise for a docs-only task or imply a push, deployment, test execution or API verification without evidence.

## Reference material

Load only what this task needs:

- [AUTH-RBAC-SECURITY.md](references/auth-rbac-security.md)

- [BRANCH-TRUTH.md](references/branch-truth.md)

- [EMAIL-LOGIN-TOKENS.md](references/email-login-tokens.md)

- [TESTING.md](references/testing.md)
