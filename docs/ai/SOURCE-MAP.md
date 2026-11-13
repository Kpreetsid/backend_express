# Local source map and evidence

The initial setup notes report inspection of CMMS_API on feature/two-step-auth at d55f2b46, 2026-11-12, with a clean worktree before setup. The subsequent instruction audit confirmed that branch/HEAD and found the instruction/docs/skill files untracked; the historical clean-state statement is not a description of the current checkout. No remote repository audit was repeated; historical links below are provenance supplied by the archive, not evidence for this branch.

Local owners inspected: package.json, tsconfig.json, .gitignore, app.ts, server.ts, nonAuthRoutes.ts, DB bootstrap/ID plugin, work-order routes/controllers/services, validation/error middleware, idempotency/sync-version helpers, transaction fallback, upload routes/storage helpers, authenticated file mounts, cron registration, auth/session/Redis paths, email-login routes, two-step service/model/controller and authentication routes. Paths are relative to src/ where not root files.

Local versions, route aliases, strict typing, express-validator, Redis/change streams, two-step challenges, upload limits, sessionless transaction fallback and targeted tests replaced archive main-branch defaults. No application build/tests/server startup, DB/Redis/SMTP connection, migration or deployment was performed. Instruction validation is separate from runtime verification.

The instruction audit also checked package scripts/dependency metadata, configuration variable owners, the existing scheduler lease and shared external-session two-step policy gate. It corrected cross-project authorization/discovery guidance and scaled verification to the actual task. Current setup gaps include undeclared/absent shx, transitive ts-node, an ignored lockfile and no runtime version pin; these docs do not remediate or verify runtime setup. Framework lookup provenance is recorded in CONTEXT7-NOTES.md.

---

# Original archive source map (provenance)

The archive author reports inspection on 2026-11-12 from the GitHub connector in `Kpreetsid/backend_express`.

| Branch | Observed recursive tree SHA | Notes |
| --- | --- | --- |
| `main` (default) | `9f468ce512eb67da3e335c589bb1be586b7f4866` | 2,021 repository files; many uploaded-content paths; no test files found by name scan |
| `feature/email-login-links` | `ac27197bfd9c71b44d9ad363e46223189f213274` | 352 files; changed structure, `src/_cache`, `src/routes`, `src/user/email-login`, many `.test.ts` files |

Representative inspected sources (always re-open in the active checkout before work):

**Main:**
- [package.json](https://github.com/Kpreetsid/backend_express/blob/main/package.json); [tsconfig.json](https://github.com/Kpreetsid/backend_express/blob/main/tsconfig.json)
- [src/app.ts](https://github.com/Kpreetsid/backend_express/blob/main/src/app.ts); [src/server.ts](https://github.com/Kpreetsid/backend_express/blob/main/src/server.ts); [src/configDB.ts](https://github.com/Kpreetsid/backend_express/blob/main/src/configDB.ts)
- [src/nonAuthRoutes.ts](https://github.com/Kpreetsid/backend_express/blob/main/src/nonAuthRoutes.ts); [src/masters/master.routes.ts](https://github.com/Kpreetsid/backend_express/blob/main/src/masters/master.routes.ts); [src/work/work.routes.ts](https://github.com/Kpreetsid/backend_express/blob/main/src/work/work.routes.ts)
- [src/work/order/order.routes.ts](https://github.com/Kpreetsid/backend_express/blob/main/src/work/order/order.routes.ts); [order.controller.ts](https://github.com/Kpreetsid/backend_express/blob/main/src/work/order/order.controller.ts); [order.service.ts](https://github.com/Kpreetsid/backend_express/blob/main/src/work/order/order.service.ts)
- [src/models/workOrder.model.ts](https://github.com/Kpreetsid/backend_express/blob/main/src/models/workOrder.model.ts); [src/util/queryBuilder.ts](https://github.com/Kpreetsid/backend_express/blob/main/src/util/queryBuilder.ts)
- [src/_config/auth.ts](https://github.com/Kpreetsid/backend_express/blob/main/src/_config/auth.ts); [src/middlewares/permission.ts](https://github.com/Kpreetsid/backend_express/blob/main/src/middlewares/permission.ts); [src/middlewares/validate.ts](https://github.com/Kpreetsid/backend_express/blob/main/src/middlewares/validate.ts); [src/middlewares/error.ts](https://github.com/Kpreetsid/backend_express/blob/main/src/middlewares/error.ts)
- [src/user/token/userToken.service.ts](https://github.com/Kpreetsid/backend_express/blob/main/src/user/token/userToken.service.ts); [src/user/authentication/authentication.service.ts](https://github.com/Kpreetsid/backend_express/blob/main/src/user/authentication/authentication.service.ts)
- [src/upload/upload.routes.ts](https://github.com/Kpreetsid/backend_express/blob/main/src/upload/upload.routes.ts); [src/_config/upload.ts](https://github.com/Kpreetsid/backend_express/blob/main/src/_config/upload.ts)
- [src/cron/index.ts](https://github.com/Kpreetsid/backend_express/blob/main/src/cron/index.ts); [src/cron/scheduler.service.ts](https://github.com/Kpreetsid/backend_express/blob/main/src/cron/scheduler.service.ts)
- [.github/workflows/main.yml](https://github.com/Kpreetsid/backend_express/blob/main/.github/workflows/main.yml); [scripts/start_app.sh](https://github.com/Kpreetsid/backend_express/blob/main/scripts/start_app.sh)

**Feature branch (separate implementation):**
- [package.json](https://github.com/Kpreetsid/backend_express/blob/feature/email-login-links/package.json); [README.md](https://github.com/Kpreetsid/backend_express/blob/feature/email-login-links/README.md)
- [src/app.ts](https://github.com/Kpreetsid/backend_express/blob/feature/email-login-links/src/app.ts); [src/_config/auth.ts](https://github.com/Kpreetsid/backend_express/blob/feature/email-login-links/src/_config/auth.ts)
- [src/user/email-login/email-login.routes.ts](https://github.com/Kpreetsid/backend_express/blob/feature/email-login-links/src/user/email-login/email-login.routes.ts)
- [src/user/support-login/support-login.routes.ts](https://github.com/Kpreetsid/backend_express/blob/feature/email-login-links/src/user/support-login/support-login.routes.ts)

## Tool reference

The archive author reports that Context7 was queried for Express 5.1 async-handler/error behavior and Mongoose 8.19 update validators and transactions. See the version-aware framework notes supplied with this package. External documentation is guidance, not proof of behavior in this codebase.

## Evidence rule

The archive author reports remote inspection of the tree and selected files. **No database was connected, no compiled artifact was run, and no endpoint/test command was executed.** Source review is not a substitute for runtime, authorization, regression, or integration testing.
