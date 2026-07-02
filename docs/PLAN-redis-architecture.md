# PLAN-redis-architecture: Redis Caching Implementation Strategy

## 🛑 Socratic Gate (Open Questions)
Before we write any code to refactor the caching layer, please consider these strategic questions:

1. **Source of Truth Updates:** Do you have cron jobs, background tasks, or direct database scripts that update MongoDB without going through the HTTP controllers? *(If yes, the current Controller-based invalidation will leave stale data in Redis).*
2. **Developer Velocity vs Performance:** The Controller proxy is very fast to implement (1 line of code), but it lacks fine-grained control. Are you willing to trade initial development speed for a significantly higher cache hit ratio and lower memory footprint?
3. **Data Sensitivity:** Are we caching any API responses that contain sensitive user data or tokens that should not be stored in plain text?
4. **Infrastructure Constraints:** Is your MongoDB running as a Replica Set? *(This is required if we want to use Change Streams for automatic cache invalidation).*

## 🏗️ Architectural Options for ExpressJS + Mongoose

Here are the four primary ways to implement Redis caching in your stack, from worst to best:

1. **Controller-Based Proxy (Current):** Caches the final HTTP response payload. 
2. **Method-Based (Service CRUD):** Explicit `Redis.get()` and `Redis.set()` logic written manually inside every service method.
3. **Decorator-Based (AOP):** Uses TypeScript decorators (e.g., `@Cacheable()`) above service methods to cleanly inject caching logic without polluting business code.
4. **Change Data Capture (CDC / Change Streams):** MongoDB Change Streams automatically detect any database write and purge the relevant Redis keys, while reads use Decorators.

## 📊 Comprehensive Difference Table

| Feature | 1. Controller Proxy (Current) | 2. Method-Based CRUD | 3. Decorator-Based (Recommended) | 4. CDC / Change Streams (Ultimate) |
|---------|---------------------------|----------------------|----------------------------------|------------------------------------|
| **Implementation Speed** | Very Fast (1 line per controller) | Slow (Boilerplate in every method) | Fast (1 line per service method) | Medium (Requires stream listener setup) |
| **Code Cleanliness** | High | Low (Pollutes business logic) | Very High (Clean separation of concerns) | Very High |
| **Invalidation Accuracy**| Poor (Tag-based, flushes everything) | High (Exact ID targeting) | High (Exact ID targeting) | Perfect (100% accurate, catches direct DB edits) |
| **Data Consistency** | Low (Fails on DB scripts/Cron jobs) | High (Catches all app writes) | High (Catches all app writes) | Perfect (Catches all DB writes globally) |
| **Memory Efficiency** | Low (Stores massive JSON payloads) | High (Stores raw objects/fields) | High (Stores raw objects/fields) | High |
| **Hit Ratio** | Low (Severe cache thrashing) | High | High | High |
| **Infrastructure Req.** | Standard | Standard | Standard | Requires MongoDB Replica Set |

## 🎯 Verdict & Best Option

**The absolute BEST option for your Enterprise Application is a hybrid of Option 3 and Option 4:**
**Decorator-Based Caching + MongoDB Change Streams for Invalidation.**

- **Why Decorators?** It gives you the exact same performance and accuracy as Method-based caching, but keeps the code as clean and fast to write as your current Controller proxy. You don't want to pollute your clean business logic with boilerplate `get/set` Redis code everywhere.
- **Why Change Streams?** If a cron job or direct script updates an Asset in MongoDB, the Node app automatically hears the event and drops the Redis cache. You never have to worry about manually calling "invalidate".

*(Note: If MongoDB Change Streams are not feasible because you don't use a Replica Set, then **Option 3 (Decorator-Based Service Caching)** alone is the strongest choice).*

---

## 📋 Implementation Plan (Task Breakdown)

### Phase 1: Foundation (Cache Manager & Decorators)
- [ ] Build a robust `CacheManager` class in `src/utils`.
- [ ] Implement explicit JSON compression (`zlib` / `snappy`) for payload storage to save RAM.
- [ ] Create TypeScript Decorators: `@Cacheable(keyPattern)`, `@CacheEvict(keyPattern)`.

### Phase 2: Refactor Core Read Operations (Services)
- [ ] Apply `@Cacheable('cmms:account:{user.account_id}:asset:{id}')` to `asset.service.ts` read methods.
- [ ] Apply `@Cacheable` to `location.service.ts` read methods.
- [ ] Remove the old `controllerCache.withCache` wrapper from `asset.controller.ts` and `location.controller.ts`.

### Phase 3: Implement Invalidation (Change Streams OR Decorators)
- **If using Change Streams (Recommended):**
  - [ ] Set up `mongoose.connection.watch()` to listen for `insert`, `update`, `delete` events across key collections.
  - [ ] Automatically parse the changed `_id` and purge `cmms:account:*:asset:{_id}` from Redis.
- **If NOT using Change Streams:**
  - [ ] Apply `@CacheEvict` decorators to `update` and `delete` methods in the services.

### Phase 4: Rollout & Verification
- [ ] Roll out to remaining modules (Work Orders, Reports, Users, etc.).
- [ ] Run benchmark tests to compare Memory usage and Cache Hit Ratios.

---

## 👥 Agent Assignments
- **`project-planner`**: Analyzed current architecture and updated this plan with alternative options.
- **`backend-specialist`**: (Next Step) Will implement the Decorators and/or Change Streams once this plan is approved.
