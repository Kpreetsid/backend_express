# Integrations, data ownership, caching and scheduled work

> Local installation: read [CURRENT-WORKSPACE.md](CURRENT-WORKSPACE.md) first. This downloaded document describes inspected remote branch snapshots; current local source, package scripts and owning AGENTS.md take precedence. Paths and security controls below must be re-traced on the active branch.

## Database connections and tenancy

- `backend_express`: Mongoose CMMS database with per-account model/query scope; optional Redis/cache modules in `src/core/cache` on `priority/bugs`.
- `Internal_ExpressJS`: separate `src/_db` connection logic for website/internal, CMMS staging, CMMS production and related processor database; code uses `getConnection(type, category)`. Mongoose models are connection-specific. **Verify exact routing and entitlement before DB access.**
- Never infer data ownership solely from collection name. Internal APIs can work with CMMS data through privileged connections and separate authentication rules.
- Use `runValidators: true` on Mongoose query updates when schema validation is required; it is not automatic by default in Mongoose 9.

## Cross-service calls

- Internal support login uses `Internal_ExpressJS -> backend_express` service-to-service HTTP with an explicit shared service credential and environment-specific base URL.
- Internal frontend uses environment selector and includes `x-db-type` for CMMS administrative calls; backend validation remains authoritative.
- Processor, device, OPC-UA and notification integrations appear in repository structures; verify concrete endpoints, secrets, payload and retry semantics before changing any connector.

## Caching and synchronization

- CMMS backend priority branch uses cache and messaging support. Invalidation must key by tenant and user where needed; never cross accounts.
- Permission updates may require both server-side invalidation and frontend state refresh. Offline cached state cannot extend revoked permission indefinitely.
- Do not cache secret-bearing authorization payloads without explicit policy and TTL.

## Scheduled jobs

- `backend_express/src/core/scheduler` owns preventive scheduler code. Distinguish desired schedule from actual successful job execution.
- Internal admin UI has cron job screens; do not assume it executes the backend jobs directly.
- All jobs should be idempotent, time-zone aware, restart safe, tenant scoped, observable and tested for duplicate execution.
