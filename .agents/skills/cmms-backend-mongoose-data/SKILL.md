---
name: cmms-backend-mongoose-data
description: "Use when changing or reviewing CMMS_API Mongoose schemas, queries, aggregations, indexes, migrations, tenancy or transaction/concurrency behavior."
---

# Mongoose models and database integrity

## Task mode and reference ownership

Resolve project paths and commands from this skill's owning repository root, even when the chat starts in CMMS-Production. Read the owning AGENTS.md and relevant scoped guides. Read-only reviews inspect and report without implementation; instruction-only changes use static metadata, link/path, reference-consistency and whitespace checks without app startup. Apply implementation and runtime-test steps below only to behavior changes. For local work prefer the corresponding canonical `docs/ai/` guide; bundled `references/` remain synchronized portable copies, not independent sources of truth.

Apply these instructions to the **current checked-out repository branch**, not a remembered branch. Read repository-root `AGENTS.md` and the affected scoped guides when present. In a cross-project CMMS-Production task, also read the workspace and frontend guides explicitly; a standalone API clone does not require them. Bundled references remain usable with this skill outside the repository, but their snapshots never replace current source. Scale the procedure to the request: for read-only review inspect and report rather than edit; instruction-only work uses static metadata/link/reference/whitespace checks rather than runtime tests.

## Procedure

1. Confirm branch/Mongoose version; read [data practices](references/data-mongoose.md) and the exact schema, callers and collection usage.
2. Preserve collection, ObjectId refs, timestamps, index/unique constraints, `visible` soft deletion, enum values and `id`/`_id` transformation.
3. Enforce server-derived tenant ownership for reads, writes, aggregations, lookups and nested data; whitelist dynamic predicates.
4. Validate update inputs and use Mongoose update validators when appropriate; consider transactions/idempotency for multi-document changes.
5. Describe migration/backfill/rollback and production implications; do not execute destructive scripts.
6. Test wrong tenant, invalid ID, duplicate/conflicting writes, partial failure, pagination, soft deletes and performance bounds in isolated DB.

## Completion contract

Report inspected branch/commit, changed paths or findings, relevant contract/data/auth impact, actual checks with `PASS/FAIL/NOT RUN`, and material unresolved decisions. Include affected methods/routes/models only when applicable. Do not invent an endpoint exercise for a docs-only task or imply a push, deployment, test execution or API verification without evidence.

## Reference material

Load only what this task needs:

- [BRANCH-TRUTH.md](references/branch-truth.md)

- [DATA-MONGOOSE.md](references/data-mongoose.md)

- [REVIEW-CHECKLIST.md](references/review-checklist.md)

- [TESTING.md](references/testing.md)
