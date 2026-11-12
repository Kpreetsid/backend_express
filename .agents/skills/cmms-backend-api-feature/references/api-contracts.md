# API routes and contract boundaries

src/app.ts mounts one API router at /api/v1, /api, and both prefixes under API_BASE_PATH (default /cmms_express). A proxy may strip or retain the outer prefix; do not invent deployed URLs.

The router contains crypto, internal account-permission events, internal support-login tokens, public user routes from src/nonAuthRoutes.ts, and authenticated /upload, /master, /opcua, /work, /reports, /map, /notifications and /knowledge-base groups. Public/internal labels do not establish authorization: inspect each handler.

Example: src/work/work.routes.ts composes order.routes.ts; its /orders mount yields GET /api/work/orders and aliases. Preserve static-route ordering before /:id. Do not infer a top-level /inspection endpoint from an inspection model.

## Validation and responses

- Body/query validators use express-validator plus src/middlewares/validator.middleware.ts. Its validation response is 422 with status, message, errors and a compatibility error field.
- src/middlewares/validate.ts exports validateParam and validateParamId; it is not the archive's Joi validateBody helper.
- Preserve endpoint envelopes, id/_id mapping, pagination and HTTP status. Work-order list responses include pagination; do not impose one uniform shape without checking consumers.
- Trace authenticated account/object ownership through service predicates; caller headers/IDs alone are not authorization.

## Retry and concurrency

src/work/order/order.routes.ts applies src/middlewares/idempotency.middleware.ts. With an Idempotency-Key, participating POST/PUT/PATCH requests bind the record to account/user/key and a request hash. Replay, in-progress conflicts and changed bodies have distinct behavior. This is not a global guarantee or proof of exactly-once effects.

src/utils/sync-concurrency.ts handles If-Match, ETag and stale-version errors (412). src/models/plugins/sync-version.plugin.ts maintains versions on covered writes. Preserve payloads and inspect atomic predicates before making concurrency claims.

Coordinate changed methods, paths, cookies, crypto/context headers and response keys with actual CMMS_APP consumers after reading that project's guide. The user's cross-project feature scope includes necessary local changes in both repositories; an API-only task does not implicitly include unrelated frontend work. Report any intentionally incompatible change and its coordinated rollout requirements.
