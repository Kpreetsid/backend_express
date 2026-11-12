# Codex change runbook: multi-application work

> Local installation: read [CURRENT-WORKSPACE.md](CURRENT-WORKSPACE.md) first. This downloaded document describes inspected remote branch snapshots; current local source, package scripts and owning AGENTS.md take precedence. Paths and security controls below must be re-traced on the active branch.

## Step 0: Read and scope

Read root `AGENTS.md`, this index, [REPOSITORIES-AND-BRANCHES.md](REPOSITORIES-AND-BRANCHES.md), [OWNERSHIP-AND-BOUNDARIES.md](OWNERSHIP-AND-BOUNDARIES.md). Record which of four repositories are in scope, selected branch of each, current git state and customer/internal environment.

## Step 1: Trace actual behavior

Build a call chain: UI event -> component -> frontend API service -> configured base URL -> backend outer router -> leaf route -> auth/role/scope middleware -> controller/service -> DB model or remote integration. Capture response shape and failure path. Verify each file exists in the active branch.

## Step 2: Record a small implementation contract

Create or update task plan with: expected behavior, explicit non-goals, affected repos, API schema delta, permission/tenant invariant, DB migration, backwards compatibility, rollout order and tests. Avoid broad "fix everything" changes in one patch.

## Step 3: Implement per vertical slice

Prefer one independent functional slice and its tests at a time. Keep frontend and backend changes small and reviewable. Reuse current codebase patterns rather than moving entire architecture or bumping framework versions as a side effect.

## Step 4: Verify

Run targeted tests, negative security tests, appropriate build/typecheck, and if permitted a locally controlled integration path with synthetic test data. Preserve actual command outputs, including failures. Do not access production customer data to test.

## Step 5: Communicate

Report precise files changed in each repo, branch/commit if any, API contract, tests and results, unsupported or unknown checks, deployment order and rollback trigger. Only commit, push or deploy on explicit authorization.

## Explicit non-goals

This documentation pack does not implement features, repair vulnerabilities, rewire CI, migrate databases or demonstrate passing runtime tests. It only provides project understanding and operating instructions for Codex.
