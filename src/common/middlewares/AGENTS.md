# Scoped HTTP middleware instructions

Follow root and src/AGENTS.md. Read src/app.ts ordering and docs/ai/API-CONTRACTS.md before changing middleware. Current helpers are validateParam/validateParamId in validate.middleware.ts, express-validator results in validator.middleware.ts, and failure/errorMiddleware in error.middleware.ts; do not copy old Joi/error.ts imports.

Preserve auth, CSRF/CORS, crypto parsing, Mongo sanitization, rate limits, permissions and authenticated file boundaries. Inspect idempotency replay and structured error consumers before changing shared responses. Test negative paths; avoid duplicate next/error responses or credential leaks.
