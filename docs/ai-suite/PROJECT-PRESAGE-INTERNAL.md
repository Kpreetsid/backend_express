# Repo guide: Kpreetsid/presageInternal (staff administration UI)

> Local installation: read [CURRENT-WORKSPACE.md](CURRENT-WORKSPACE.md) first. This downloaded document describes inspected remote branch snapshots; current local source, package scripts and owning AGENTS.md take precedence. Paths and security controls below must be re-traced on the active branch.

## Purpose and features

Internal management application for accounts, employees, assigned customer companies, role menus, customer CMMS administrative access, blogs, knowledge-base publishing, sales leads, invoice tracking, SAP mapping, sensors/devices/gateway, alarms, data lookups and reports.

## Architecture

- Root `AppModule` and Angular route registry at `src/app/app-routing.module.ts`.
- Features in `src/app/pages`, backend service wrappers in `src/app/services`, auth guard at `src/app/auth.guard.ts`.
- SSR/hydration configured; browser-only APIs must be guarded. On `priority/bugs`: Angular 20, TypeScript 5.8. Default `master`: Angular 18, TS 5.5.
- `src/app/services/api.service.ts` sends `x-db-type` on CMMS admin calls. Backend must enforce environment and company grants.
- Remote snapshot: token interceptor uses trusted-origin policy; support login state uses browser CSPRNG. Local master has neither control as described; see CURRENT-WORKSPACE.md and inspect `src/app/services/token.interceptor.ts`.
- Knowledge-base publisher service calls `/api/internal/knowledge-base`, with `updatedAt` concurrency and PDF binary response.

## Security and cross-repo rules

- Internal role-menu UI controls navigation. The backend must enforce action privileges; verify current route enforcement rather than assuming universal coverage.
- Desired support-login invariants include staff authorization, company/environment, state challenge and a service grant. The local frontend still calls the legacy external-token GET directly; the documented Internal proxy is absent locally.
- Account-level changes may require CMMS backend permission cache invalidation and customer frontend reload.

## Commands

`priority/bugs`: `npm run typecheck`, `npm run typecheck:spec`, `npm run test:security`, `npm run test:ci`, `npm run build`. SSR/hydration, password/session behavior, environment selection and permission denial deserve dedicated tests. No PWA feature parity with cmmsF is assumed.
