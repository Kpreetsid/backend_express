# CMMS Express REST API

Enterprise-grade Computerized Maintenance Management System (CMMS) REST API organized as a modular monolith.

## Architecture

The codebase follows a pragmatic modular monolith pattern with clear dependency boundaries:

```txt
src/
  app.ts                         # Express app construction & middleware composition only (no listening/connections)
  server.ts                      # Process entrypoint, config validation, and runtime bootstrap
  core/                          # Technical infrastructure & runtime platform
    auth/                        # Auth middleware, cookie handling, tokens
    bootstrap/                   # Dependency-aware startup, shutdown, and rollback lifecycle
    cache/                       # Redis client, controller cache gates, change streams
    config/                      # Environment configuration & fail-fast schema validation
    database/                    # MongoDB connection pooling & Mongoose plugins
    logger/                      # Centralized structured logging & log queue
    mailer/                      # SMTP / transactional email services
    messaging/                   # User log producers & consumers
    scheduler/                   # Automated cron jobs & cadence runners
    socket/                      # Socket.IO notification gateway & metrics
  common/                        # Shared, business-neutral utilities & middlewares
    constants/                   # Canonical system constants & experience profiles
    errors/                      # Typed application error classes
    middlewares/                 # Request context, CSRF, rate limiter, payload crypto, sanitize
    types/                       # Common Express request & pagination type augmentations
    utils/                       # Cryptographic helpers, response formatters, ID validation
  modules/                       # Domain & business capabilities
    assets/                      # Asset inventory, equipment, buzzer, sensors
    auth/                        # User registration, verification, authentication
    communications/              # Mail logs, posts, notification dispatching
    company/                     # Accounts, organizations, features
    locations/                   # Plant hierarchy, buildings, floors, rooms
    maintenance/                 # Preventative maintenance schedules & masters
    mappings/                    # User-to-location & user-to-asset mapping
    reports/                     # Analytics, operational reports, exports
    settings/                    # Analysis features, system settings, status
    users/                       # User management, roles, permissions, menus
    work-orders/                 # Work requests, orders, documentation
  routes/                        # Route registration & legacy prefix mounts
    index.ts                     # API mounts: /api/v1, /api, and ${API_BASE_PATH} aliases
    v1/                          # Versioned route group definitions
    health.routes.ts             # Health, liveness, readiness, and metrics endpoints
    crypto.routes.ts             # Cryptographic handshake & session bootstrap
openapi/
  cmms-api.v1.yaml               # OpenAPI 3.0 specification for API contracts
```

## Runtime Lifecycle & Observability

The application implements a dependency-aware bootstrap and idempotent shutdown lifecycle (`src/core/bootstrap/runtime.ts`):
1. **Config Validation**: Validates ports, secrets, and crypto parameters before any network connections.
2. **Resource Sequencing**: Connects MongoDB (required), Redis (optional), Change Streams, Socket.IO, Schedulers, and Consumers before opening the HTTP port.
3. **Rollback**: Automatically cleans up all opened resources if startup fails at any point.
4. **Graceful Shutdown**: Idempotent shutdown with a 15-second bounded deadline when receiving SIGINT/SIGTERM.

### Health & Metrics Endpoints

- `GET /health`: Backward-compatible process health check.
- `GET /health/live`: Liveness probe for process supervision.
- `GET /health/ready`: Readiness probe verifying MongoDB connectivity and Redis state (HTTP 200 when ready, 503 if degraded).
- `GET /metrics`: Prometheus formatted metrics for uptime, database status, redis status, and notification socket connections.

## Payload Cryptography

Payload cryptography is controlled purely via environment variables:

| Variable | Description | Default |
|---|---|---|
| `PAYLOAD_CRYPTO_ENABLED` | Master toggle for payload encryption/decryption | `false` |
| `PAYLOAD_CRYPTO_REQUEST_ENABLED` | Decrypts incoming request payload envelopes | `false` |
| `PAYLOAD_CRYPTO_RESPONSE_ENABLED` | Encrypts outgoing response bodies | `false` |
| `PAYLOAD_CRYPTO_MASTER_SECRET` | Master AES-256 key for payload cryptography | - |

- Plaintext requests pass naturally without mandatory custom header requirements.
- Request payload envelopes are decrypted using the envelope's key identifier (`kid`).
- Cryptography flags are completely decoupled from database account records.

## Controller-Based Redis Caching

Redis is optional and operates through controller-level caching (`src/core/cache/`):

```ts
REDIS_ENABLED !== 'false'
&& account_master.redis_status === 'enabled'
&& Redis client is ready
```

If Redis is disabled or unavailable, all operations automatically fall back to durable MongoDB execution.

## Quality Gates & Verification

Run the full enterprise verification pipeline locally before committing or deploying:

```powershell
# Run architecture boundary validation, TypeScript check, and production build
npm run verify

# Run individual quality gates
npm run check:architecture   # Enforce module boundaries & forbid layer violations
npm run typecheck            # TypeScript compiler validation (0 errors)
npm run build                # Compile TypeScript to dist/ and copy assets
npm start                    # Run the compiled production artifact (node dist/server.js)
```

