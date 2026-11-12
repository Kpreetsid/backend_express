# Validation and error handling

Current helpers are src/middlewares/validate.ts (validateParam/validateParamId), src/middlewares/validator.middleware.ts (express-validator results), and src/middlewares/error-handler.ts (failure/status/code and terminal middleware). Inspect neighboring validators such as src/work/order/workOrder.validator.ts.

- Validate body, path, query, pagination, sort and file metadata before side effects. ID middleware emits bad-request errors; body validation currently returns 422 with a compatibility error field. Preserve consumer contracts.
- Distinguish malformed input, unauthenticated, forbidden, missing resource, conflict, stale version (412), rate limit and unavailable dependency responses. Do not flatten failures into success or generic 500s.
- Preserve structured codes/data used by auth/sync clients. Do not leak stacks, raw queries, credentials or request bodies into responses/logs.
- Existing middleware checks headersSent and delegates when necessary. Follow local async error style without sending or forwarding twice.
- Error middleware can echo err.message and logs diagnostic fields. Sanitization is a property to verify on the affected path, not a proven global guarantee.
- Test validation/error mapping using mocked failures, including invalid IDs, conflicting writes, failed auth and stale If-Match where relevant.

The archive's Joi/error.ts examples describe a different snapshot; use active source instead.
