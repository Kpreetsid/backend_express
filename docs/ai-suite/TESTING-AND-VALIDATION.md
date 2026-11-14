# Branch-aware test commands and acceptance gates

> Local installation: read [CURRENT-WORKSPACE.md](CURRENT-WORKSPACE.md) first. This downloaded document describes inspected remote branch snapshots; current local source, package scripts and owning AGENTS.md take precedence. Paths and security controls below must be re-traced on the active branch.

**Do not claim a test passed until run locally with exit status and observed assertions.** These commands are derived from inspected package scripts; dependency installation, test database configuration and Chrome availability are not verified.

| Repository and branch | Baseline commands present in package.json | Notes |
|---|---|---|
| `cmmsF` `priority/bugs` | `npm run typecheck`, `npm run typecheck:spec`, `npm run test:security`, `npm run test:ci`, `npm run build` | Karma ChromeHeadless required; run targeted specs first |
| `cmmsF` `master` | `npm run build`, `npm test` (inspect scripts) | Different Angular version and paths; no blanket assumption about lint target |
| `backend_express` `priority/bugs` | `npm run typecheck`, `npm run build`, `npm run test:cmms`, `npm run test:email-login`, `npm run test:password-security`, `npm run test:asset-train`, `npm run catalog:check` | No generic `npm test` script observed in priority package |
| `backend_express` `main` | `npm start` (compiles then runs server) | No standalone test script observed. Avoid `npm start` purely as a typecheck; prefer `npx tsc --noEmit` after install |
| `presageInternal` `priority/bugs` | `npm run typecheck`, `npm run typecheck:spec`, `npm run test:security`, `npm run test:ci`, `npm run build` | Angular 20, Karma/ChromeHeadless |
| `presageInternal` `master` | `npm test`, `npm run build` | Angular 18; inspect actual script |
| `Internal_ExpressJS` `priority/bugs` | `npm test`, `npm run test:security` | Node built-in test runner; no TypeScript compiler |
| `Internal_ExpressJS` `master` | `npm test` | Node built-in test runner |

## Mandatory matrix for a cross-repo feature

1. Unit test both validation and success logic in owning backend.
2. Negative auth tests: unauthenticated, role denied, wrong account/environment, invalid/expired token, missing file.
3. Contract test: same URL + method + request + response on both sides.
4. Frontend component/service tests for success, 4xx, 5xx, loading/empty states and cleanup.
5. Browser test for route reload, deep link, session switch, SSR (internal) or PWA (CMMS) if relevant.
6. Mutation test for retry/concurrent update/rollback/idempotency when relevant.
7. Build/typecheck for each repo changed and test available CI workflow locally where possible.
8. Supply evidence table with exact command, branch, exit code, counts and known untested cases.

## Known command pitfalls to verify

- `cmmsF` priority `test:mcsa` references `tsconfig.mcsa.spec.json`; no matching file appeared in the inspected tree. Treat that command as **unverified/broken until confirmed**, not a green requirement.
- `ng lint` may lack a configured Angular architect lint target; read `angular.json` before calling it.
- `npm ci` requires a lockfile. `priority/bugs` snapshots had lockfiles; some default branches did not.
- `backend_express` priority uses TypeScript aliases and build tooling; plain `node --test` on TS without loaders is not equivalent to configured tests.
