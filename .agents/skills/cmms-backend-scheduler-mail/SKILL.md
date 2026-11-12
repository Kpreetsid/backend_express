---
name: cmms-backend-scheduler-mail
description: "Use when working on CMMS_API cron, preventive scheduling, automatic work orders, mail delivery or related retry/side-effect failures."
---

# Scheduled jobs and mail side effects

Apply these instructions to the **current checked-out repository branch**, not a remembered branch. Read repository-root `AGENTS.md` and the affected scoped guides when present. In a cross-project CMMS-Production task, also read the workspace and frontend guides explicitly; a standalone API clone does not require them. Bundled references remain usable with this skill outside the repository, but their snapshots never replace current source. Scale the procedure to the request: for read-only review inspect and report rather than edit; instruction-only work uses static metadata/link/reference/whitespace checks rather than runtime tests.

## Procedure

1. Read [scheduler and mail](references/scheduler-mail.md), inspect cron registration, schedule model, service and mail handlers on the current branch.
2. Define business timezone, schedule occurrence key, eligible state and how multiple workers acquire the right to execute.
3. Prevent duplicate work-order creation using durable idempotency or atomic claims; identify transaction/compensation needs for DB+email effects.
4. Handle retries, process restart, DB outage, partial mapping and mail failure without disclosing recipients or credentials.
5. Test clock boundaries, repetition limits, skipped days, retry/concurrency and partial failure with fake timers, mocked mail and test DB.
6. Report evidence, outstanding operational decisions and no-real-mail guarantee.

## Completion contract

Report inspected branch/commit, changed paths or findings, relevant contract/data/auth impact, actual checks with `PASS/FAIL/NOT RUN`, and material unresolved decisions. Include affected methods/routes/models only when applicable. Do not invent an endpoint exercise for a docs-only task or imply a push, deployment, test execution or API verification without evidence.

## Reference material

Load only what this task needs:

- [BRANCH-TRUTH.md](references/branch-truth.md)

- [DATA-MONGOOSE.md](references/data-mongoose.md)

- [SCHEDULER-MAIL.md](references/scheduler-mail.md)

- [TESTING.md](references/testing.md)
