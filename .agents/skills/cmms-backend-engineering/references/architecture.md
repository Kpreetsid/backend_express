# CMMS_API architecture map

Local snapshot: feature/two-step-auth at d55f2b46, inspected 2026-11-12. This is a navigation map, not a runtime or security certification.

## Startup and transport

- src/server.ts registers the global ID-standardization Mongoose plugin, imports app, calls app.listen, then connects MongoDB and Redis, initializes change streams, Socket.IO, cron and the Redis user-log consumer. Shutdown stops the consumer, disconnects dependencies and closes the listener. Importing startup code can start external activity.
- src/app.ts configures trust proxy and installs Helmet, request context, CORS, cookies, CSRF, JSON/urlencoded parsers, crypto response/request middleware, Mongo sanitization, logging, global rate limiting and compression in source order.
- Authenticated static-file mounts precede API mounts. The root upload mount excludes knowledge_base. Health and metrics mounts are distinct from API routes; inspect their individual handlers before claiming access policy.
- The shared API router mounts at /api/v1, /api and their API_BASE_PATH-prefixed aliases. src/nonAuthRoutes.ts registers user flows; protected domain mounts use isAuthenticated. Final unmatched-route handling and errorMiddleware terminate the chain.

## Domain ownership

| Area | Source landmarks |
| --- | --- |
| Root and protected routers | src/app.ts, src/nonAuthRoutes.ts, src/masters/master.routes.ts, src/work/work.routes.ts |
| Auth/session/permissions | src/_config/auth.ts, src/_role/, src/user/authentication/, src/middlewares/permission.ts |
| Two-step login | src/user/two-step/, src/user/authentication/authentication.routes.ts |
| Email and support credentials | src/user/email-login/, src/user/support-login/ |
| Assets and catalog-driven trains | src/masters/asset/, src/catalog/, catalog/, scripts/generate-asset-train-catalog.cjs |
| Work orders and requests | src/work/ and its nested routers |
| Persistence/transforms | src/models/, src/_db/mongoosePlugins.ts, src/models/plugins/ |
| Caching, sessions, change streams | src/_cache/, src/_config/redis.ts, src/utils/redis.service.ts |
| Upload/storage/private files | src/upload/, src/_config/storage.ts, src/middlewares/authenticatedStatic.ts |
| Reports, mappings, events | src/reports/, src/transaction/, src/notification/, src/_config/socket.ts |
| Jobs and mail | src/cron/, src/_config/mailer.ts |
| Validation/errors | src/middlewares/validate.ts, src/middlewares/validator.middleware.ts, src/middlewares/error-handler.ts |

## Trace before editing

Route + alias -> middleware -> controller -> service -> models and account/visibility filters -> cache invalidation/change streams -> events/mail/files -> response/error -> tests and client consumers. Services can combine multiple models and side effects; inspect the whole path before changing one write.

Work orders already integrate idempotency middleware, sync versions/ETags, activity history, inventory, mappings and transactions. Preserve their contracts where used; do not assume other routers have the same guarantees.

Mongo is durable storage. Redis is gated by configuration and may be unavailable; inspect each cache/session fallback rather than assuming every consumer tolerates failure. Source names do not prove a durable offline queue or exactly-once replay.
