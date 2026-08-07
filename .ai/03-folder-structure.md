# Folder Structure

## Existing folders

| Folder | Responsibility | Import restrictions |
|---|---|---|
| `src/_config` | Auth, CORS, socket, mail, crypto, storage adapters | No controller imports |
| `src/_db` | Connection and global Mongoose behavior | No HTTP imports |
| `src/middlewares` | Cross-cutting HTTP policies | No feature persistence |
| `src/models` | Schemas, indexes, persistence types | No controller/service imports |
| `src/masters` | Company, user, location, asset, inspection, parts masters | Use common infrastructure only |
| `src/work` | Requests, orders, procedures, templates, comments | Cross-module calls through services |
| `src/reports` | Read/report projections and PDF generation | No mutation except report records |
| `src/transaction` | Mapping operations | Tenant and permission scope required |
| `src/notification` | Notification repository/routes | Socket emit through notification service |
| `src/upload` | Upload HTTP flow | Storage abstraction only |
| `src/utils` | Reusable infrastructure/domain-neutral helpers | Must not become a service dumping ground |

## New production folders

- `src/common`: typed errors, request context, logger, telemetry, API metadata.
- `src/cache`: Redis client, key registry, cache policy, health.
- `src/queues`: BullMQ connections, job envelopes, producers, workers.
- `src/storage`: provider implementations and storage health.
- `src/openapi`: OpenAPI document and compatibility metadata.
- `src/repositories`: shared tenant repository primitives; feature-specific
  repositories remain with their module.
- `tests`: unit, integration, contract, fixtures, and test bootstrap.

## Forbidden patterns

- New direct `process.env` reads outside `configDB.ts`.
- New local-disk assumptions outside the local storage adapter.
- New Socket.IO events outside the notification contract.
- New unscoped MongoDB queries for tenant-owned collections.
- New business logic inside routes, middleware, cron callbacks, or workers.
- Circular feature imports or shared utilities importing controllers.

