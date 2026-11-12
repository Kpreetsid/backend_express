# Current local workspace

Inspected 2026-11-12. Recheck branch, HEAD, status and package.json before each task. This is source/configuration evidence, not executed application or production verification.

Read [repository instructions](../../AGENTS.md) and [existing project playbooks](../ai/README.md) before the downloaded suite snapshots. Local source wins over copied branch descriptions.

| Pack / GitHub name | Local folder | Role | Branch at installation | HEAD |
| --- | --- | --- | --- | --- |
| cmmsF | CMMS_APP | Customer Angular UI | feature/two-step-auth | a82fb164ac19e04bfeee360b589e4baffe4c960f |
| backend_express | CMMS_API | Customer Express/TypeScript API | feature/two-step-auth | 6299b6d4056056fbc15cce9bcc18aa1899cc6ade |
| presageInternal | INTERNAL_APP | Internal Angular UI | master | 9a10e47693df360888da9507d2fe61a996262e9f |
| Internal_ExpressJS | INTERNAL_API | Internal Express/JavaScript ESM API | master | 48a0afe1c193d6ab2f41ce8e2562190a91350b26 |

## Local source layouts and commands

### CMMS_APP

Angular ^15.2.10, TypeScript ^4.9.5. Use `src/app/default`, `_services`, `_interceptors`, `login/two-step`, not the remote priority `features/core` layout.

Scripts currently declared: `prestart`, `prebuild`, `ng`, `start`, `start:local`, `build`, `test`, `test:ci`, `test:mcsa`, `typecheck:spec`, `lint`, `e2e`. Read the actual command body and existing `docs/ai/TESTING.md` before running.

### CMMS_API

Express ^5.3.0, TypeScript ^6.0.3, Mongoose ^9.11.2. Use `src/masters`, `work`, `user`, `_config`, not the remote priority `modules/core/common` layout.

Scripts currently declared: `dev`, `build`, `start`, `typecheck`, `test:user-notifications`, `test:cmms-report`, `test:password-security`, `catalog:generate`, `catalog:check`, `test:catalog`, `test:asset-train`. Read the actual command body and existing `docs/ai/TESTING.md` before running.

### INTERNAL_APP

Angular ^18.2.14, TypeScript ~5.5.4. Use `src/app/pages` and `src/app/services`; preserve SSR/browser boundaries. Do not apply Angular 20 examples without checking compatibility.

Scripts currently declared: `ng`, `start`, `build`, `watch`, `test`, `serve:ssr:presage_internal`. Read the actual command body and existing `docs/ai/TESTING.md` before running.

### INTERNAL_API

Express ^5.3.0, Mongoose ^9.12.1, JavaScript ESM. Use `.js` imports, `src/internal`, `src/cmms`, connection-specific models; no TypeScript compiler assumed.

Scripts currently declared: `dev`, `migrate:account-role-menu`, `migrate:sales-lead-role-menu`, `test`, `start`. Read the actual command body and existing `docs/ai/TESTING.md` before running.

## Integration differences that matter

- The remote secure POST support-login chain is not implemented as described in these checkouts. INTERNAL_APP `src/app/services/api.service.ts` currently calls GET `/api/users/create_external_token/:email`. INTERNAL_API `src/app.js` / `src/cmms/cmms.routes.js` do not mount the documented POST `/api/cmms/support-login` or `/api/service/support-login` flow. An untracked support-login directory does not establish route wiring.
- CMMS_API `src/user/authentication/authentication.routes.ts` registers GET `/users/create_external_token/:email` and GET `/users/logout`; do not copy the pack's POST descriptions. Trace outer API prefixes and authentication before using either.
- The local service-protected support issuer is mounted at `/internal/support-login-tokens` in CMMS_API `src/app.ts`, with GET/POST leaf routes under `src/user/support-login/`. Inspect controller/service checks; this is distinct from the legacy external-token route.
- Local customer email-login routes are in CMMS_API `src/user/email-login/`, registered by `src/nonAuthRoutes.ts`. Keep fragment transport, purpose/account/session checks and safe redirects. A 604800-second TTL is source configuration, not authorization to change product policy.
- Frontend controls, requested `x-db-type`, model names and downloaded architecture descriptions do not prove server-side authorization. Trace actual middleware and owning connections.

- INTERNAL_APP `src/app/services/token.interceptor.ts` currently adds a bearer token whenever present without an origin allowlist, and `support-login-state.ts` is absent. The pack's trusted-origin/CSPRNG claims describe another snapshot, not protections verified here. This installation changes documentation only.

## Task routing and discovery

Use `$presage-cross-repo-change` for two or more applications, including the Internal UI/API pair and the existing `$cmms-fullstack-development` router for CMMS_APP/CMMS_API-only work. Repository engineering entry points remain `$cmmsf-engineering`, `$cmms-backend-engineering`, `$presage-internal-engineering`, and `$presage-internal-api-engineering`. Read each affected project's `.agents/skills/<name>/SKILL.md` directly if it is absent from the current skill catalog.

See [skill routing](SKILL-ROUTING.md) for explicit specialist ownership, compatibility names and synchronized-copy policy.

Each installed overlay includes local suite references for a standalone checkout. Shared skill copies use the same names and guidance; do not load multiple copies of the same skill. Root routing owns local folder aliases. Siblings are optional in standalone clones; never invent missing checkouts. New files may require a fresh chat to appear in the skill catalog; explicit file reads work in the current chat.

## Verification boundaries

Instruction-only changes need metadata, link/path, scope, preservation and whitespace checks. No application startup, dependency installation, live DB/mail, build artifacts, runtime integration, push, merge or deployment is implied. Backend start/dev commands connect services and may cause side effects. Source evidence is not a PASS for application tests.
