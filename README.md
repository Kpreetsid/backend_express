# CMMS ExpressJS

## Controller-based Redis caching

Redis is optional and is used only when all runtime gates are open:

```ts
REDIS_ENABLED !== 'false'
&& account_master.redis_status === 'enabled'
&& Redis client is ready
```

`account_master.redis_status` is the per-company runtime switch and is the primary cache control. `REDIS_ENABLED` is not required for Redis to run; leave it unset or set it to `true`. Set `REDIS_ENABLED=false` only when you need a server-wide emergency kill switch. Missing account settings, disabled account Redis, or Redis connection errors all fall back to normal MongoDB/service execution.

### Implementation pattern

Controllers opt in through `controllerCache.withCache(...)` at their export line. The wrapper caches read methods, invalidates after successful mutation methods, and uses keys scoped by account and user:

```txt
cmms:{accountId}:{userId}:{namespace}:{operation}:{hash(params,query,body)}
```

Routes should keep only routing/auth/validation/permission responsibilities. Redis decisions belong to controllers through each controller's namespace, tags, TTL, read method overrides, mutation method overrides, and skip method overrides.

`RedisUtils` in `src/utils/redis.service.ts` is the shared low-level Redis command wrapper. Use it for Redis strings, hashes, lists, sets, sorted sets, counters, and scan-based pattern deletion. Request-scoped cache code must still call the controller/cache gate before reading or writing Redis; `RedisUtils` does not replace account `redis_status`, client-readiness checks, or the optional `REDIS_ENABLED=false` kill switch.

## JWT-compatible Redis session metadata

The API does not use `express-session`; it keeps the existing JWT access token and refresh-token cookie contract. Redis mirrors token/session metadata for faster auth checks using keys like `cmms:session:access:{hash}`, `cmms:session:refresh:{hash}`, and `cmms:user-sessions:{accountId}:{userId}`. MongoDB `CustomAccessToken` remains the durable fallback, so login, refresh, auth checks, and logout continue to work if Redis is unavailable.

Keep `CACHE_CHANGE_STREAMS_ENABLED=false` when MongoDB is running without a replica set. Cache invalidation should use controller mutation wrappers and service-level eviction decorators, not MongoDB Change Streams.

### Verification

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

## Work-order creation acknowledgement from SAP

Create, update, status-update, and delete operations on `/api/v1/work/orders`
commit the CMMS mutation first. The backend then sends POST, PATCH, or DELETE to
the SAP middleware and waits for its acknowledgement. Every mutation response includes
`sapAcknowledgement` and the `X-SAP-Sync-Status` header. A middleware failure does
not roll back an already committed CMMS mutation; it is returned explicitly as
`sapAcknowledgement.status = "failed"`.

Configure the deployed backend:

```dotenv
SAP_MIDDLEWARE_ENABLED=true
SAP_MIDDLEWARE_URL=https://your-sap-middleware.example.com
SAP_MIDDLEWARE_CREATE_PATH=/api/v1/master/sap/records
# Must equal SAP_CREATE_API_KEY in the middleware deployment.
SAP_MIDDLEWARE_API_KEY=generate-a-random-secret-containing-at-least-32-characters
SAP_MIDDLEWARE_TIMEOUT_MS=15000
SAP_MIDDLEWARE_DEFAULT_ORDER_TYPE=PM01
SAP_MIDDLEWARE_DEFAULT_MAINTENANCE_PLANT=1000
```

For the bundled local SAP simulator, keep the backend on port `3010` and use
`SAP_MIDDLEWARE_URL=http://127.0.0.1:3011`; `dev:simulator-flow` starts the
middleware on `3011` to avoid a port collision.

The backend maps `order_no`, `title`, `description`, `priority`, `status`, and the
selected asset's external `asset_id`. It also sends the authenticated CMMS account
and user IDs to the middleware, which resolves the active SAP identity mapping before
the SAP request is made. A caller can optionally supply signed-off SAP
business values without controlling the generated SAP maintenance-order identity:

```json
{
  "title": "Inspect pump seals",
  "priority": "High",
  "wo_location_id": "<Mongo ObjectId>",
  "wo_asset_id": "<Mongo ObjectId>",
  "sap": {
    "OrderType": "PM01",
    "MaintenancePlant": "1000",
    "Equipment": "EQ-0001"
  }
}
```

Successful creation returns HTTP 201 with:

```json
{
  "status": true,
  "message": "Work order created and acknowledged by SAP.",
  "data": {},
  "sapAcknowledgement": {
    "status": "acknowledged",
    "idempotencyKey": "work-order-<CMMS Mongo ID>",
    "sapStatus": 201,
    "record": {}
  }
}
```

Updates and deletes return the same acknowledgement shape with `operation` set to
`update` or `delete`. The backend derives the SAP record ID from `order_no`, uses
stable mutation-specific idempotency keys, and never sends the CMMS MongoDB ID as
the SAP maintenance-order identity.
