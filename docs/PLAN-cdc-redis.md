# PLAN-cdc-redis: Decorator + CDC / Change Streams Redis Implementation

---

## ✅ Pre-Implementation Clarification: How CDC Works With Your API

> **Your Question:** Will CDC update data in MongoDB AND Redis based on data created/updated by API?

**Answer: YES — and here is exactly how it works:**

```
API Request (POST /assets)
        │
        ▼
[1] Controller → Service → MongoDB.save()   ← Your existing API code does this
        │
        ▼
[2] MongoDB fires a Change Stream event     ← New: CDC listener detects the write
        │
        ▼
[3] CDC Handler: "Asset 'abc123' was inserted"
        │
        ├── Delete: cmms:prod:{accountId}:asset:abc123  (exact key)
        └── Delete: cmms:prod:{accountId}:asset:list    (collection key)
        │
        ▼
[4] Next API Request (GET /assets/abc123)
        │
        ▼
[5] @Cacheable Decorator: Cache MISS → Fetch from MongoDB → Store in Redis
        │
        ▼
[6] Cache is now fresh and consistent ✅
```

**Critical difference from current system:** In the current Controller Proxy, step [2] and [3] are replaced by a `res.once('finish')` hook that runs AFTER the HTTP response is already sent, meaning the invalidation can fail silently. With CDC, step [2] is triggered directly by MongoDB itself — no HTTP cycle involved.

---

## 📊 Final Difference Table: Current vs Proposed (CDC + Decorator)

| Dimension | Current (Controller Proxy) | Proposed (CDC + Decorator) |
|-----------|---------------------------|----------------------------|
| **Caching Level** | HTTP Response (JSON payload) | Service/Data level (raw objects) |
| **Invalidation Trigger** | HTTP `finish` event | MongoDB Change Stream event |
| **Who Triggers Invalidation** | HTTP Response Lifecycle | MongoDB itself |
| **Invalidation Scope** | Entire tag namespace (e.g. all `assets`) | Exact key (e.g. `asset:abc123`) |
| **Cron Job / Script Updates** | ❌ NOT caught | ✅ Automatically caught |
| **Stale Cache Risk** | HIGH | VERY LOW |
| **Hit Ratio** | LOW (one write = namespace flush) | HIGH (one write = one key flush) |
| **Memory Usage** | HIGH (stores full JSON payload + status code) | LOW (stores raw DB document) |
| **Code Cleanliness** | 1-line per controller | 1-decorator per service method |
| **Multi-tenant Safety** | Medium (uses accountId in hash) | HIGH (explicit key pattern per account) |
| **Infrastructure Req.** | None extra | MongoDB Replica Set required |
| **Cron/Scheduler Changes** | Not cached, not invalidated | CDC auto-invalidates on any DB write |
| **Production Scalability** | Poor in multi-node | High with Redis Pub/Sub |
| **Debugging** | Hard (hashed keys) | Easy (human-readable keys) |
| **Socket.IO Readiness** | Not ready | Ready (Redis Adapter compatible) |

---

## 🏗️ Architecture Overview

```
 ┌─────────────────────────────────────────────────────────────────┐
 │                  CMMS Express Application                        │
 │                                                                  │
 │  HTTP Layer:   Controller  →  Service  →  MongoDB               │
 │                                │                                 │
 │  Cache Read:    @Cacheable ────┘  (before MongoDB query)        │
 │  Cache Write:   @Cacheable ────────────→  Redis SET             │
 │                                                                  │
 │  Invalidation:  MongoDB ──── Change Stream ──→ CDC Handler      │
 │                              (any write)        └──→ Redis DEL  │
 └─────────────────────────────────────────────────────────────────┘
```

---

## 📋 New Files to Create

| File | Purpose |
|------|---------|
| `src/_cache/cacheKeys.ts` | Centralized human-readable key patterns |
| `src/_cache/cacheManager.ts` | Core Redis get/set/del manager (replaces direct RedisUtils usage) |
| `src/_cache/decorators/cacheable.decorator.ts` | `@Cacheable` TypeScript decorator |
| `src/_cache/decorators/cacheEvict.decorator.ts` | `@CacheEvict` TypeScript decorator |
| `src/_cache/changeStream/index.ts` | CDC entry point (registers all collection watchers) |
| `src/_cache/changeStream/asset.stream.ts` | CDC handler for Asset collection |
| `src/_cache/changeStream/location.stream.ts` | CDC handler for Location collection |
| `src/_cache/changeStream/user.stream.ts` | CDC handler for User collection |
| `src/_cache/changeStream/workOrder.stream.ts` | CDC handler for WorkOrder collection |
| `src/_cache/changeStream/notification.stream.ts` | CDC handler for Notification collection |
| `src/_cache/changeStream/schedule.stream.ts` | CDC handler for ScheduleMaster collection |
| `src/_cache/changeStream/part.stream.ts` | CDC handler for Part collection |
| `src/_cache/changeStream/role.stream.ts` | CDC handler for UserRoleMenu collection |
| `src/_cache/changeStream/mapping.stream.ts` | CDC handler for MapUser (Asset/Location) collections |

---

## 📦 Module-by-Module Implementation Plan

### Phase 1: Core Infrastructure (Days 1-2)

#### 1.1 `src/_cache/cacheKeys.ts` — Key Pattern Registry
Define all key naming patterns with `account_id`, `env`, and entity `id`. This prevents any key collision across tenants.

```typescript
// Pattern: cmms:{env}:{accountId}:{entity}:{id}
// Example: cmms:production:account123:asset:asset456

export const CacheKeys = {
  asset:      (accountId: string, id: string) => `cmms:${ENV}:${accountId}:asset:${id}`,
  assetList:  (accountId: string) => `cmms:${ENV}:${accountId}:asset:list`,
  location:   (accountId: string, id: string) => `cmms:${ENV}:${accountId}:location:${id}`,
  locationList:(accountId: string) => `cmms:${ENV}:${accountId}:location:list`,
  user:       (accountId: string, id: string) => `cmms:${ENV}:${accountId}:user:${id}`,
  userList:   (accountId: string) => `cmms:${ENV}:${accountId}:user:list`,
  workOrder:  (accountId: string, id: string) => `cmms:${ENV}:${accountId}:workOrder:${id}`,
  workOrders: (accountId: string) => `cmms:${ENV}:${accountId}:workOrder:list`,
  notification:(userId: string) => `cmms:${ENV}:${userId}:notification:list`,
  role:       (accountId: string) => `cmms:${ENV}:${accountId}:role:list`,
  schedule:   (accountId: string) => `cmms:${ENV}:${accountId}:schedule:list`,
  part:       (accountId: string, id: string) => `cmms:${ENV}:${accountId}:part:${id}`,
  partList:   (accountId: string) => `cmms:${ENV}:${accountId}:part:list`,
  settings:   (accountId: string) => `cmms:${ENV}:${accountId}:settings`,
  report:     (accountId: string, assetId: string) => `cmms:${ENV}:${accountId}:report:${assetId}`,
};
```

#### 1.2 `src/_cache/cacheManager.ts` — Core Cache Manager
Wraps `RedisUtils` with typed `getOrSet` and `del` methods. Handles serialization, compression, and TTL.

#### 1.3 `src/_cache/decorators/cacheable.decorator.ts` — Read Decorator
Intercepts service method calls, resolves the key pattern, checks Redis, and on miss calls MongoDB then stores result.

#### 1.4 `src/_cache/decorators/cacheEvict.decorator.ts` — Write Decorator (Fallback)
Used only as a fallback if CDC is not available. Invalidates specific keys after a successful write.

---

### Phase 2: CDC Change Stream Infrastructure (Days 3-4)

#### 2.1 `src/_cache/changeStream/index.ts` — CDC Registry
```typescript
// Registers all model watchers after DB connects
export const initChangeStreams = (connection: mongoose.Connection) => {
  watchAssets(connection);
  watchLocations(connection);
  watchUsers(connection);
  watchWorkOrders(connection);
  watchSchedules(connection);
  watchParts(connection);
  watchRoles(connection);
  watchMappings(connection);
};
```
This is called in `server.ts` immediately after `await connectDB()`.

#### 2.2 Per-Collection Stream Handlers
Each handler watches for `insert`, `update`, `replace`, `delete` operations and calls `CacheManager.del()` with the **exact** affected keys.

---

### Phase 3: Module Refactoring (Days 5-10)

#### 3.1 Masters Module — `src/masters/`

| File | Cache Action | Key Invalidated by CDC |
|------|-------------|------------------------|
| `asset/asset.service.ts` | Add `@Cacheable` to `getAllAssets`, `getAssetById` | `CacheKeys.asset(accountId, id)`, `CacheKeys.assetList(accountId)` |
| `location/location.service.ts` | Add `@Cacheable` to `getAllLocations`, `getTree` | `CacheKeys.location(accountId, id)`, `CacheKeys.locationList(accountId)` |
| `user/user.service.ts` | Add `@Cacheable` to `getAllUsers`, `getUserDetails` | `CacheKeys.user(accountId, id)`, `CacheKeys.userList(accountId)` |
| `user/role/roles.controller.ts` | Add `@Cacheable` to read methods | `CacheKeys.role(accountId)` |
| `part/parts.service.ts` | Add `@Cacheable` to read methods | `CacheKeys.part(accountId, id)` |
| `schedule/schedule.service.ts` | Add `@Cacheable` to read methods | `CacheKeys.schedule(accountId)` |
| `equipment/equipment.service.ts` | Add `@Cacheable` to read methods | `CacheKeys.equipment(accountId)` |
| `sops/sops.service.ts` | Add `@Cacheable` to read methods | `CacheKeys.sops(accountId)` |
| `formCategory/formCategory.service.ts` | Add `@Cacheable` | `CacheKeys.formCategory(accountId)` |
| `inspection/inspection.service.ts` | Add `@Cacheable` | `CacheKeys.inspection(accountId)` |
| `observation/observation.service.ts` | Add `@Cacheable` | `CacheKeys.observation(accountId)` |
| `troubleshoot-guide/troubleshoot-guide.service.ts` | Add `@Cacheable` | `CacheKeys.troubleshootGuide(accountId)` |

**Controller Change:** Remove `controllerCache.withCache(new AssetController(), ...)` wrappers from ALL controller files in this directory.

---

#### 3.2 Work Module — `src/work/`

| File | Cache Action | TTL |
|------|-------------|-----|
| `order/order.service.ts` — read methods | `@Cacheable(CacheKeys.workOrder)` | 2 minutes |
| `order/order.service.ts` — write methods | CDC auto-invalidates | — |
| `request/request.service.ts` | `@Cacheable` on reads | 5 minutes |
| `procedure/procedure.service.ts` | `@Cacheable` on reads | 15 minutes |
| `orderTemplate/orderTemplate.service.ts` | `@Cacheable` on reads | 30 minutes |
| `instruction/instruction.service.ts` | `@Cacheable` on reads | 15 minutes |
| `comments/comment.service.ts` | ❌ **DO NOT CACHE** (real-time data) | — |

**Note:** Work Order dashboard aggregation methods (`orderStatus`, `monthlyCount`, etc.) should use a **short TTL of 60 seconds** — cached at the service level with `accountId` as part of the key.

---

#### 3.3 Transaction / Mapping Module — `src/transaction/`

| File | Cache Action |
|------|-------------|
| `mapUserAsset/userAsset.service.ts` | `@Cacheable` on read queries (User→Asset mappings) |
| `mapUserLocation/userLocation.service.ts` | `@Cacheable` on read queries (User→Location mappings) |
| `mapUserWorkOrder/userWorkOrder.service.ts` | `@Cacheable` on reads |
| `mapUserInspection/*.service.ts` | `@Cacheable` on reads |

**CDC:** When a mapping document changes, the CDC handler must also invalidate the **parent asset or location's list cache** since `getAllAssets()` joins mapping data.

---

#### 3.4 Notification Module — `src/notification/`

| File | Cache Action |
|------|-------------|
| `notification.service.ts` — `getUserNotifications` | `@Cacheable(CacheKeys.notification(userId), TTL=30s)` |
| `notification.service.ts` — `updateStatus` | CDC auto-invalidates `notification:list:{userId}` |

**CDC note:** Notifications change frequently. Keep TTL at **30 seconds** only. The real-time delivery is already handled by Socket.IO — CDC here is just for the REST polling endpoint.

---

#### 3.5 Settings Module — `src/settings/`

| File | Cache Action |
|------|-------------|
| `redisStatus.service.ts` — in-memory `statusCache` Map | Keep as-is (already optimal) |
| Settings Model — `redis_status` | If settings update: CDC invalidates `CacheKeys.settings(accountId)` — TTL 24 hours |

---

#### 3.6 Reports Module — `src/reports/`

| File | Cache Action | TTL |
|------|-------------|-----|
| `asset/asset.service.ts` — `getAllAssetReports` | `@Cacheable(CacheKeys.report(accountId, assetId))` | 10 minutes |
| `location/location.service.ts` — read methods | `@Cacheable` | 10 minutes |
| `asset/asset.service.ts` — `generateAssetReportPdf` | ❌ **DO NOT CACHE** (dynamic PDF) | — |

**Note:** Report caches are invalidated by the Asset report CDC stream when a report document is updated.

---

#### 3.7 Authentication Module — `src/user/authentication/`

CDC is NOT used here. Direct Redis usage for security tokens:

| Feature | Redis Operation | TTL |
|---------|----------------|-----|
| JWT Blacklist (logout) | `SET cmms:blacklist:{jti} 1 EX {remaining_jwt_ttl}` | Matches JWT remaining TTL |
| OTP Storage | `SET cmms:otp:{email} {otp} EX 300` | 5 minutes |
| Login Rate Throttling | Use Redis-backed `rate-limit-redis` store | 15 minutes |
| Password Reset Token | `SET cmms:reset:{email} {token} EX 900` | 15 minutes |

---

#### 3.8 Cron / Scheduler — `src/cron/`

| File | Change |
|------|--------|
| `scheduler.service.ts` | CDC handles invalidation: when a `ScheduleMaster` doc is updated (e.g., `last_execution_date`), CDC deletes `CacheKeys.schedule(accountId)` |
| `assetAlarmSnooze.service.ts` | CDC handles invalidation on `AssetReport` writes |

**Note:** Cron jobs that use `SchedulerModel.updateOne()` will automatically trigger CDC — no extra code needed in the cron service itself.

---

### Phase 4: TTL Strategy by Module

| Module | Cache Key | Recommended TTL |
|--------|-----------|----------------|
| Asset Detail | `cmms:prod:{accId}:asset:{id}` | 15 minutes |
| Asset List | `cmms:prod:{accId}:asset:list` | 5 minutes |
| Location Detail | `cmms:prod:{accId}:location:{id}` | 15 minutes |
| Location List | `cmms:prod:{accId}:location:list` | 5 minutes |
| User Detail | `cmms:prod:{accId}:user:{id}` | 30 minutes |
| User List | `cmms:prod:{accId}:user:list` | 10 minutes |
| Roles / Permissions | `cmms:prod:{accId}:role:list` | 1 hour |
| Work Order Detail | `cmms:prod:{accId}:workOrder:{id}` | 2 minutes |
| Work Order Dashboard | `cmms:prod:{accId}:workOrder:dashboard` | 60 seconds |
| Parts | `cmms:prod:{accId}:part:list` | 30 minutes |
| Schedule | `cmms:prod:{accId}:schedule:list` | 10 minutes |
| Notifications | `cmms:prod:{userId}:notification:list` | 30 seconds |
| Report Data | `cmms:prod:{accId}:report:{assetId}` | 10 minutes |
| Settings | `cmms:prod:{accId}:settings` | 24 hours |
| OTP | `cmms:otp:{email}` | 5 minutes (strict) |
| JWT Blacklist | `cmms:blacklist:{jti}` | Remaining JWT lifetime |

---

### Phase 5: server.ts Integration

```typescript
// server.ts — After connectDB()
import { initChangeStreams } from './_cache/changeStream';

const server = app.listen(hostDetails.port, async () => {
  const { mongo } = await connectDB();
  await connectRedis();
  initChangeStreams(mongo.connection); // ← Add this line
  initSocket(server);
  await initJobScheduler();
});
```

---

### Phase 6: Verification Checklist

- [ ] All 30 controllers no longer use `controllerCache.withCache()`
- [ ] `src/_cache/controllerCache.service.ts` is either deleted or kept only for backward compatibility
- [ ] Each service's read method has `@Cacheable` decorator with correct key pattern
- [ ] CDC stream fires and invalidates correct key when tested with Postman (POST then GET)
- [ ] Cron job runs and CDC stream auto-invalidates `schedule:list` key
- [ ] `REDIS_KEY_PREFIX` env var replaced by `cmms:{NODE_ENV}:` pattern in `CacheKeys.ts`
- [ ] JWT blacklist implemented in authentication service
- [ ] OTP stored in Redis, not MongoDB
- [ ] Rate limiters use Redis store
- [ ] Load test shows improved Cache Hit Ratio (target > 70%)

---

## 👥 Agent Assignments

- **`project-planner`**: Created this plan with full module analysis
- **`backend-specialist`**: Will implement `CacheKeys`, `CacheManager`, Decorators, and CDC streams
- **`security-auditor`**: Will validate JWT blacklist and OTP Redis security implementation
