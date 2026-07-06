# CMMS ExpressJS

## Controller-based Redis caching

Redis is optional and is used only when all runtime gates are open:

```ts
REDIS_ENABLED !== 'false'
&& account_master.redis_status === 'enabled'
&& Redis client is ready
```

`account_master.redis_status` is the per-company runtime switch and is the primary cache control. `REDIS_ENABLED` is not required for Redis to run; leave it unset or set it to `true`. Set `REDIS_ENABLED=false` only when you need a server-wide emergency kill switch. Missing account settings, disabled account Redis, or Redis connection errors all fall back to normal MongoDB/service execution.

### Environment variables

```env
# Optional global kill switch. Unset/true allows account-level redis_status to control caching.
REDIS_ENABLED=true
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_KEY_PREFIX=cmms
REDIS_DEFAULT_TTL_SECONDS=300
REDIS_STATUS_TTL_SECONDS=30
REDIS_CONNECT_TIMEOUT_MS=3000
```

### Implementation pattern

Controllers opt in through `controllerCache.withCache(...)` at their export line. The wrapper caches read methods, invalidates after successful mutation methods, and uses keys scoped by account and user:

```txt
cmms:{accountId}:{userId}:{namespace}:{operation}:{hash(params,query,body)}
```

Routes should keep only routing/auth/validation/permission responsibilities. Redis decisions belong to controllers through each controller's namespace, tags, TTL, read method overrides, mutation method overrides, and skip method overrides.

`RedisUtils` in `src/utils/redis.service.ts` is the shared low-level Redis command wrapper. Use it for Redis strings, hashes, lists, sets, sorted sets, counters, and scan-based pattern deletion. Request-scoped cache code must still call the controller/cache gate before reading or writing Redis; `RedisUtils` does not replace account `redis_status`, client-readiness checks, or the optional `REDIS_ENABLED=false` kill switch.

### Verification

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```
