# Local backend coding conventions

Inspect the nearest route/controller/service/model and tests before adding code. Follow the module's naming and imports; do not introduce a parallel service hierarchy or framework for a local feature.

- Follow TypeScript 6 with strict/noImplicitAny/noUnusedLocals/noImplicitReturns and ES2024/NodeNext settings in tsconfig.json; the package remains CommonJS. Do not paste ESM-only setup from another checkout.
- Keep route registration, validation, request/response handling and business/data work in their established files. Use typed DTO/state boundaries without rewriting unrelated legacy types.
- Preserve route aliases, role keys, account feature checks, response envelopes, pagination and status/error codes. Match neighboring async next(error) handling; avoid double responses/forwarding.
- Use existing express-validator chains and validate middleware for body/query constraints; validateParamId validates the id parameter. Inspect the actual field before reusing a validator.
- Clean up timers, listeners, streams and resources. Shared middleware changes require consumer review.
- Construct queries from allowlisted input and verified identity; apply account/visibility filters to nested reads, writes and joins. Related asset/location/user records must belong to the account.
- Preserve collection names, indexes, enums, serializers, global id mapping, sync versions and history plugins. Review update operators/validation against the schema.
- Preserve Idempotency-Key, If-Match and ETag behavior on participating routes. Check cache ownership, eviction, session/permission invalidation and socket consumers when state changes.
- Account for withTransaction's sessionless fallback and possible callback re-execution. Database transactions do not make mail/file effects atomic.
- Keep logs/fixtures free of credentials, raw tokens, OTPs and customer data. Do not change origins, production configuration, dependencies or deployment as incidental cleanup.

Verify relevant success/failure behavior and report actual commands/limitations. See DATA-MONGOOSE.md, AUTH-RBAC-SECURITY.md and TESTING.md for affected work.
