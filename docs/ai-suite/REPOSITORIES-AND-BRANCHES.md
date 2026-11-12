# Repositories, branches, and version differences

> Local installation: read [CURRENT-WORKSPACE.md](CURRENT-WORKSPACE.md) first. This downloaded document describes inspected remote branch snapshots; current local source, package scripts and owning AGENTS.md take precedence. Paths and security controls below must be re-traced on the active branch.

| GitHub repository | Main role | Default branch snapshot | priority/bugs snapshot | Critical difference |
|---|---|---|---|---|
| `Kpreetsid/cmmsF` | Customer CMMS UI | `master` | `priority/bugs` | Earlier `src/app/default`, `_services` versus reorganized `src/app/features`, `core`, `shared` |
| `Kpreetsid/backend_express` | Customer CMMS API | `main` | `priority/bugs` | Earlier `src/masters`, `work`, `user`, `_config`; reorganized `src/modules`, `src/core`, `src/common` |
| `Kpreetsid/presageInternal` | Internal admin UI | `master` | `priority/bugs` | Angular 18 versus Angular 20; more security/typecheck scripts on priority branch |
| `Kpreetsid/Internal_ExpressJS` | Internal administration and privileged CMMS API | `master` | `priority/bugs` | ES-module architecture on both; priority branch expands security and scope middleware |

## Framework fingerprints

- `cmmsF` `priority/bugs`: Angular 16.2.12 / TypeScript 5.1.6, Karma/Jasmine, Angular service worker. Default `master` was observed with an older Angular 15 structure; **read its own package.json** rather than applying priority branch paths.
- `backend_express` `priority/bugs`: Express 5.3, Mongoose 9.11, TypeScript 6, path aliases, `npm run build` via `scripts/build.cjs`. Default `main`: Express 5.1, Mongoose 8.20, TypeScript 5.9 and a different folder layout.
- `presageInternal` `priority/bugs`: Angular 20.3, TypeScript 5.8, NgModule root with lazy standalone components, SSR. `master`: Angular 18.2, TypeScript 5.5.
- `Internal_ExpressJS` `priority/bugs`: Node ESM JavaScript, Express 5.2, Mongoose 9.9; `master`: Express 5.3 and Mongoose 9.12. Do not import TypeScript patterns from the CMMS API.

## Mandatory branch check

```sh
git branch --show-current
git status --short
cat package.json
rg --files src | head -80
```

Read paths only after checking existence. If `priority/bugs` is active, prefer the relevant paths shown in [SOURCE-MAP.md](SOURCE-MAP.md). If using `master`, `main`, `feature/email-login-links`, or any other branch, re-trace the actual router and module file paths. The `feature/email-login-links` backend branch is a separate snapshot and must not be conflated with `priority/bugs` or `main`.

## Evidence policy

A file being present proves only code presence; it does not prove a route is mounted, authorized, deployed, tested or functional. For a claimed feature, show both entry-point wiring and actual behavior/test evidence. For an API, follow outer `app.ts`/`app.js` router prefixes to leaf route. Do not use default-branch GitHub view as evidence for a non-default checkout.
