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
