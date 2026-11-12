# Cross-application architecture

> Local installation: read [CURRENT-WORKSPACE.md](CURRENT-WORKSPACE.md) first. This downloaded document describes inspected remote branch snapshots; current local source, package scripts and owning AGENTS.md take precedence. Paths and security controls below must be re-traced on the active branch.

## Applications and data responsibilities

```text
Customer user --> cmmsF (Angular customer UI)
                 | HTTP, cookies, headers, optional socket
                 v
                 backend_express (CMMS API; TypeScript Express)
                    | MongoDB, optional Redis, email, uploads, jobs

Internal staff --> presageInternal (Angular admin UI)
                  | HTTP /api/internal and /api/cmms
                  v
                  Internal_ExpressJS (internal API; ES-module Express)
                    |-- Website/internal DB
                    |-- Selected staging/production CMMS databases
                    |-- privileged service-to-service calls --> backend_express

Internal publisher --> Internal_ExpressJS knowledge-base writes
                                      | metadata and managed PDF files
                                      v
Customer reader --> backend_express knowledge-base read API --> cmmsF
```

This diagram describes observed code-level communication and storage roles, **not** proven network deployment topology. Databases and shared file locations depend on server configuration.

## Application entry points

| Repo | Front door | Modules and layers |
|---|---|---|
| `cmmsF` | `src/app/app.module.ts`, `app-routing.module.ts` | `src/app/features`, `src/app/core`, `src/app/shared` on `priority/bugs` |
| `backend_express` | `src/app.ts`, `src/server.ts` | `src/routes/v1`, `src/modules`, `src/core`, `src/common` on `priority/bugs` |
| `presageInternal` | `src/app/app.module.ts`, `app-routing.module.ts` | `src/app/pages`, `src/app/services`, `src/app/core` |
| `Internal_ExpressJS` | `src/app.js`, `src/server.js` | `src/internal`, `src/cmms`, `src/middlewares`, `src/_db` |

## Design principles for Codex

1. Treat each backend as an independent trust boundary; browser authentication to one API never automatically authorizes the other.
2. Treat `Internal_ExpressJS` CMMS access as a privileged cross-environment capability, not a generic client-side proxy.
3. Respect content ownership: internal knowledge-base publisher writes; CMMS knowledge-base API reads published guides only.
4. Keep source-based claims distinct from production verification.
5. Require explicit cross-repo contract work when changing payload names, permission keys, status codes, URL prefixes or refresh/session semantics.
6. Never copy an API implementation between TS CommonJS and JS ESM without reviewing module semantics, validation and database abstractions.
