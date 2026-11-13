# Backend coding patterns by application and branch

> Local installation: read [CURRENT-WORKSPACE.md](CURRENT-WORKSPACE.md) first. This downloaded document describes inspected remote branch snapshots; current local source, package scripts and owning AGENTS.md take precedence. Paths and security controls below must be re-traced on the active branch.

## backend_express (CMMS API)

- `priority/bugs`: TypeScript 6, Express 5, route registry under `src/routes/v1`, module domains under `src/modules`, auth/config/cache/scheduler under `src/core`, middleware under `src/common`.
- `main`: older source `src/masters`, `src/work`, `src/user`, `src/middlewares`; do not use priority aliases in main.
- Follow: outer router -> nested route -> validators and middleware -> controller -> service -> model -> response/error mapping.
- For every CRUD endpoint, require account filter in all reads/writes; check role/feature grant and resource association, not just authenticated user.
- For mutations across inventory, work orders, mappings, file metadata or notifications, assess transactions, idempotency and compensation.
- Error middleware should produce safe error codes; Express 5 propagates rejected async handlers, but preserve project wrapper patterns and avoid double `next()` calls.

## Internal_ExpressJS (staff and privileged CMMS API)

- JavaScript ESM (`type: module`), Express 5, Mongoose 9; files use `.js` import specifiers.
- Internal `/api/internal` and privileged `/api/cmms` have different root authentication policies on `priority/bugs`; trace both outer and nested middleware.
- `src/_db/index.js` exposes multiple connections. Build models against resolved connection; never let an arbitrary browser field select an unrestricted DB.
- Staff action permission is not the same as customer account role. `requireInternalPermission` and explicit CMMS action/context checks are server responsibilities.
- Keep `express-validator` chains and error middleware consistent with existing route structure. Avoid using TypeScript decorators, NestJS assumptions, CommonJS `require`, or Mongoose global-default models without evidence.

## Shared backend review gates

| Change type | Mandatory checks |
|---|---|
| New endpoint | Route reachable, auth, role, account/env scope, input validation, response contract, error handling |
| New DB query | Index/bounds, resource ownership, optimistic concurrency, projection, update validation |
| File API | Signature, size, path, private read ACL, cache headers, cleanup |
| External service call | Secret handling, timeout, retry policy, actor/environment binding, safe logs |
| Scheduled job | Unique execution, idempotency, repeat/run windows, dry-run test fixtures |
| Caching | Tenant-specific key and invalidation, fail-open vs fail-closed decision |
