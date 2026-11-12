# Template - cross-project Codex task

> Local installation: read [CURRENT-WORKSPACE.md](CURRENT-WORKSPACE.md) first. This downloaded document describes inspected remote branch snapshots; current local source, package scripts and owning AGENTS.md take precedence. Paths and security controls below must be re-traced on the active branch.

Copy this into a Codex request and fill the concrete inputs; do not treat any section as permission to mutate unrelated projects.

```text
Use $presage-cross-repo-change and read AGENTS.md + docs/ai-suite/INDEX.md.
Goal: [user-visible change and testable acceptance criteria]
Affected applications: [cmmsF, backend_express, presageInternal, Internal_ExpressJS]
Branches: [record current git branch for each]
Environment: [local / controlled staging / production (read-only unless approved)]
Current failure: [repro inputs, expected, actual]
Non-goals: [features/endpoints/DBs that must not change]
Contract: [HTTP method, URL, request/response, auth, tenant, permission]
Implementation: analyze current source -> make minimal vertical-slice changes -> add tests.
Security: test 401, 403, wrong account/environment, stale session, unauthorized files.
Validation: run actual target test and build/typecheck commands; disclose failures.
Delivery: summarize file-by-file diff, commands, exit codes, API changes and rollback.
Do not commit, push, deploy, email users or alter production data without approval.
```
