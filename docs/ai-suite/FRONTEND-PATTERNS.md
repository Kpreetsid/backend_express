# Frontend coding patterns by application and branch

> Local installation: read [CURRENT-WORKSPACE.md](CURRENT-WORKSPACE.md) first. This downloaded document describes inspected remote branch snapshots; current local source, package scripts and owning AGENTS.md take precedence. Paths and security controls below must be re-traced on the active branch.

## cmmsF - customer-facing CMMS

- On `priority/bugs`, Angular 16 with `AppModule` bootstrap, `features/` for user-facing domains, `core/` for identity/interceptors/services and `shared/` for reusable UI.
- On `master`, folders differ (`default/`, `_services/`, `_interceptors/`); inspect local `app-routing.module.ts`, modules and injection registration before editing.
- Customer app service worker uses `ServiceWorkerModule.register` only in production; `ngsw-config.json` controls caching. Do not assume browser SSR in this app.
- Build features by tracing lazy routes, component, domain service, API client/config, role guard, reusable UI, and component/service tests.
- Keep RxJS subscriptions bounded with lifecycle cleanup; avoid introducing duplicate HTTP calls, stale cached user/tenant state, or leaking tokens through router URLs.

## presageInternal - staff administration UI

- On `priority/bugs`, Angular 20 with root NgModule and lazy `loadComponent` routes, SSR/hydration; on `master`, Angular 18.
- Route/source: `src/app/app-routing.module.ts`, page components in `src/app/pages`, HTTP/service abstractions in `src/app/services`.
- Inspect the current `UserService` and `TokenInterceptor` before reuse; the remote trusted-origin policy is absent on local master. Verify credential destinations; do not inject internal bearer tokens into CMMS processor or arbitrary external URLs.
- Use `AuthGuard` and explicit role-menu navigation hints, but backend permission checks are authoritative.
- For SSR, guard browser globals (`window`, `document`, `localStorage`, `navigator`) behind platform checks or platform-safe abstractions; test server execution and hydration.

## Common frontend acceptance criteria

- Loading, empty, success, validation, 401, 403, 404, 409, 429 and network states.
- Accessibility and keyboard focus; no destructive action on navigation-only elements.
- Safe unsubscribe/cleanup, race prevention after user/account switch.
- Exact request method/base URL and payload; no undocumented endpoint creation.
- Component and service tests with mocked HTTP and negative auth cases.
- No cross-app change to global design system or framework version unless specifically requested.
