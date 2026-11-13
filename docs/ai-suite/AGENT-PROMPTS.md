# Ready-to-use Codex prompts for the four-app suite

> Local installation: read [CURRENT-WORKSPACE.md](CURRENT-WORKSPACE.md) first. This downloaded document describes inspected remote branch snapshots; current local source, package scripts and owning AGENTS.md take precedence. Paths and security controls below must be re-traced on the active branch.

## 1. Trace a shared feature

```text
Use $presage-cross-repo-change. Read AGENTS.md and docs/ai-suite/INDEX.md. For [feature], trace every caller and handler across cmmsF, backend_express, presageInternal, and Internal_ExpressJS. Confirm active branches. Output ownership, exact source files, API method/path, auth/permissions/tenant, data model, tests and missing integration points. Do not edit code.
```

## 2. Implement a contract-aware change

```text
Use $presage-contract-tracing and $presage-auth-boundaries. Implement [acceptance criteria] in only the necessary repos. First document current frontend request and backend route, then preserve response compatibility, add denied/invalid tests, run targeted validations, and return file-by-file changes. Do not push or deploy.
```

## 3. Security audit

```text
Use $presage-auth-boundaries. Audit [module] on current checkout for unauthorized tenant access, environment switch, role-menu bypass, file leak, token/query leak and stale session. Cite code paths and tests, label confirmed bugs vs hypotheses, and make no changes unless asked.
```

## 4. Check feature completeness

```text
Use $presage-feature-audit. Compare the four apps' implementation of [domain] against docs/ai-suite/FEATURE-MATRIX.md. Check mounted routes, UI affordances, backend action permissions, data ownership, positive/negative tests and error states. Return a gap matrix; do not claim production validation unless tests ran.
```

## 5. Validate before release

```text
Use $presage-regression-validation and $presage-release-readiness. Enumerate the exact branch/commit, changed repositories, commands, results, contract compatibility, staging-only smoke tests, environment scope and rollback trigger. No production actions without my explicit approval.
```
