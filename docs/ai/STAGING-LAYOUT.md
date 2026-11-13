# Current staging layout

Updated during the 2026-11-13 integration of feature/two-step-auth tip 8656ee06 into staging tip 06f5dd6c. Other imported documents describe dated feature-branch snapshots; inspect current source before using their old paths or commands.

- `src/app.ts` mounts API aliases and middleware; public identity routes register in `src/routes/v1/public.routes.ts`, with protected master routes in `src/routes/v1/master.routes.ts`.
- Domain routes/controllers/services/models live in `src/modules/`. Infrastructure is in `src/core/`, middleware and shared helpers in `src/common/`.
- Authentication routes/controllers/services are in `src/modules/auth/`; email-login and support-login retain their own subdirectories there. The public email-only legacy issuer existed in both merge tips; this merge preserves its existing behavior. Support-token issuance remains POST-only.
- Two-step implementation remains in `src/user/two-step/`, with policy controllers in `src/modules/company/services/two-step-settings.controller.ts`. A pending challenge is not a session. The external-session boundary rejects current two-step policy before role or session writes.
- Profile controllers are `src/modules/users/controllers/user-profile.controller.ts` and `src/modules/company/controllers/company-profile.controller.ts`; strict shared validation is in `src/common/utils/profile.validation.ts`. Literal PATCH `/master/users/profile` and `/master/companies/profile` precede ID routes and use the authenticated principal's user/account scope.
- Cache wrapping uses `src/core/cache/controller-cache.service.ts`; Redis helpers/client live beside it. HTTP helpers are in `src/common/middlewares/`, with terminal errors in `error.middleware.ts`.
- Location report generation remains in `src/reports/location/`; `docs/cmms-location-report.md` retains staging's reporting changes. Package scripts, dependency declarations, SAP code and other staging domain behavior are preserved.

Run checks from this repository root. `npm run typecheck` is static; `npm run test:password-security`, `npm run test:email-login`, `npm run test:cmms` and `npm run test:cmms-report` use isolated tests. Profile and two-step direct commands are in [TESTING.md](TESTING.md). Do not start the server as a compile check.
