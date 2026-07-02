# CMMS ExpressJS

## Controller-based Redis caching

Redis is optional and is used only when all runtime gates are open:

```ts
redisConfig.enabled === true
&& SettingsModel.redis_status === 'enabled'
&& Redis client is ready
```

`REDIS_ENABLED` is the server-wide safety switch. `SettingsModel.redis_status` is the per-company runtime switch stored in `app_settings`. Missing settings, disabled Redis, or Redis connection errors all fall back to normal MongoDB/service execution.

### Environment variables

```env
REDIS_ENABLED=false
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

`RedisUtils` in `src/utils/redis.service.ts` is the shared low-level Redis command wrapper. Use it for Redis strings, hashes, lists, sets, sorted sets, counters, and scan-based pattern deletion. Request-scoped cache code must still call the controller/cache gate before reading or writing Redis; `RedisUtils` does not replace `REDIS_ENABLED`, `SettingsModel.redis_status`, or client-readiness checks.

### Verification

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```
