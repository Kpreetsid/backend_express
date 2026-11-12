---
name: cmms-backend-pr-deploy-review
description: "Use when requested to review CMMS_API diffs, pull requests or release/deployment readiness. Read-only unless implementation is explicitly requested."
---

# Pull request, CI and deployment review

Apply these instructions to the **current checked-out repository branch**, not a remembered branch. Read repository-root `AGENTS.md` and the affected scoped guides when present. In a cross-project CMMS-Production task, also read the workspace and frontend guides explicitly; a standalone API clone does not require them. Bundled references remain usable with this skill outside the repository, but their snapshots never replace current source. Scale the procedure to the request: for read-only review inspect and report rather than edit; instruction-only work uses static metadata/link/reference/whitespace checks rather than runtime tests.

## Procedure

1. Confirm branch/HEAD and PR diff. Read [review checklist](references/review-checklist.md) and [deployment](references/deployment.md).
2. Review all changed route/middleware/model and external side effects, including auth, tenant access, file handling, tokens, cron and mail.
3. Verify current workflow triggers, deployment paths, rollback, Node/TypeScript compatibility and safe environment config injection.
4. Demand executable checks and test evidence for changed behavior; never claim CI deployed just because YAML exists.
5. Present ordered findings with file/line, severity, impact and recommended action; separate `PASS/FAIL/NOT RUN` checks.
6. Do not perform push, merge, migration, AWS deployment or PM2 restart without authorization.

## Completion contract

Report inspected branch/commit, changed paths or findings, relevant contract/data/auth impact, actual checks with `PASS/FAIL/NOT RUN`, and material unresolved decisions. Include affected methods/routes/models only when applicable. Do not invent an endpoint exercise for a docs-only task or imply a push, deployment, test execution or API verification without evidence.

## Reference material

Load only what this task needs:

- [BRANCH-TRUTH.md](references/branch-truth.md)

- [DEPLOYMENT.md](references/deployment.md)

- [REVIEW-CHECKLIST.md](references/review-checklist.md)

- [TESTING.md](references/testing.md)
