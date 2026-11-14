# Repo guide: Kpreetsid/cmmsF (customer frontend)

> Local installation: read [CURRENT-WORKSPACE.md](CURRENT-WORKSPACE.md) first. This downloaded document describes inspected remote branch snapshots; current local source, package scripts and owning AGENTS.md take precedence. Paths and security controls below must be re-traced on the active branch.

## Purpose and feature families

Angular customer-facing CMMS UI: authentication, accounts/roles, assets, equipment, devices, locations, alarms, analytics dashboards, work orders, work requests, preventive maintenance, inspections, parts, procedures/SOPs, reports, knowledge-base, notifications, PWA/offline.

## `priority/bugs` source map

- Application registration: `src/app/app.module.ts`, `src/app/app-routing.module.ts`.
- Domain features: `src/app/features/*`; auth and request policies: `src/app/core/*`; shared state, directives and UI: `src/app/shared/*`.
- API and account context: `src/app/core/services/pages/*`, auth/authorization services, account permission synchronization.
- Email links: `src/app/features/auth/email-login/email-login.component.ts`; `UserService.inspectEmailLogin/exchangeEmailLogin` uses `/api/users/email-login/...`.
- KB customer reader: `src/app/features/knowledge-base/knowledge-base.service.ts` calls CMMS backend `/api/knowledge-base` (read-only).
- Service worker: `ngsw-config.json`; app module's production SW registration; `src/app/features/offline` and offline navigation service.

## Default master differences

Earlier `master` uses Angular 15 and paths under `src/app/default`, `_services`, `_interceptors`, `shared`. Never apply imports from priority tree to master automatically.

## Commands and scope

On priority: `npm run typecheck`, `npm run typecheck:spec`, `npm run test:security`, `npm run test:ci`, `npm run build`. Check ChromeHeadless and Angular CLI availability. The existing `test:mcsa` command references a tsconfig not seen in snapshot.

For a new screen, trace route -> component -> domain service -> backend contract -> permission UI -> tests. Changes to server-side permissions, write actions, persisted offline mutation handling and notifications require coordination with `backend_express`.
