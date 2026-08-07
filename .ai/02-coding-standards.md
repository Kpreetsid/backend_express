# Coding Standards

## TypeScript

- Strict mode remains enabled. Do not suppress errors with broad `any`,
  `@ts-ignore`, non-null assertions without a proven invariant, or config
  relaxation.
- Public functions declare return types. Domain inputs use named interfaces or
  DTOs. Unknown external input remains `unknown` until validated.
- Prefer immutable values, narrow functions, early returns, and explicit
  exhaustiveness.
- Use bracket access only where the platform type is an index signature.
- Optional properties are omitted rather than explicitly assigned `undefined`.

## Naming

- Files: `feature.controller.ts`, `feature.service.ts`,
  `feature.repository.ts`, `feature.validator.ts`, `feature.routes.ts`.
- Types/classes: PascalCase. Values/functions: camelCase. Environment keys and
  constants: UPPER_SNAKE_CASE.
- Boolean names begin with `is`, `has`, `can`, `should`, or `enabled`.
- Stable error codes use UPPER_SNAKE_CASE.

## Layer rules

- Controllers contain no query construction beyond parsing validated filters.
- Services receive an authenticated tenant context explicitly.
- Database access for new/refactored code goes through tenant-scoped
  repositories.
- Common validation is extracted once and mirrored in Angular.
- Transactions are sequential within a MongoDB session; never use parallel
  operations on the same session.
- Configuration is read only from `src/configDB.ts`.

## Logging and errors

- Use the structured logger, never log secrets, tokens, passwords, raw payload
  crypto material, or unrestricted request bodies.
- Throw domain/application errors with stable code, safe message, status, and
  optional validation details.
- Preserve existing response shapes. Add request IDs and codes only
  additively.

## Review gates

- No endpoint or response break.
- Tenant scope is explicit and tested.
- Frontend/backend validation remains synchronized.
- Tests cover success, authorization, validation, conflict, and failure paths.
- `npm run check:enterprise`, tests, builds, and `git diff --check` pass.

