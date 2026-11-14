# Agent task template

Copy this block into a Codex task:

```text
Repo: CMMS_API
Branch: <branch; agent must verify current HEAD>
Objective: <specific behavior, with before/after contract>
Module/paths: <paths or ask agent to trace>
Constraints: No prod data, email, deployment, secrets or unapproved Git pushes.
API compatibility: <unchanged or approved change details>
Security: Tenant/account isolation, auth, RBAC, validation and safe errors must remain intact.
Acceptance criteria:
- <happy path>
- <invalid input>
- <unauthorized/wrong account>
- <failure or retry behavior>
Checks: Use package.json on active branch; report PASS/FAIL/NOT RUN.
Deliverable: diff + precise route/data contract + tests + remaining risks.
```

For a planning-only request add: `No code changes, commits, deployments or external side effects.`

For a task spanning CMMS_APP and CMMS_API, name both repositories and read both owning guides plus the workspace guide when present; necessary local changes in both are within that task's scope. Keep commits/PRs separate if requested. For instruction-only work replace route/runtime acceptance cases with metadata, discovery, path/link, reference-copy, scope and whitespace checks; application startup, builds and endpoint tests are not required.
