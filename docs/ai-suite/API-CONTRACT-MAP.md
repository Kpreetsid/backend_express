# Cross-repository API contract map

> Local installation: read [CURRENT-WORKSPACE.md](CURRENT-WORKSPACE.md) first. This downloaded document describes inspected remote branch snapshots; current local source, package scripts and owning AGENTS.md take precedence. Paths and security controls below must be re-traced on the active branch.

**Evidence status:** routes and method names below are observed on `priority/bugs`. Deployment proxies may rewrite base paths; verify actual environment configuration and route registries.

## Customer CMMS API (`backend_express`)

`src/app.ts` mounts the same API router at `/api`, `/api/v1`, and `/<API_BASE_PATH>/api` / `/<API_BASE_PATH>/api/v1`, with configured default `API_BASE_PATH` of `/cmms_express`.

| Route family | Verb/path relative to `/api` | Consumer / notes |
|---|---|---|
| Login | `POST /users/login` | `cmmsF` session creation |
| Access refresh | `POST /users/refresh`, `POST /auth/refresh` | Preserve cookies/CSRF contract |
| Current principal | `GET /users/me` | authenticated user context |
| Account logout | `GET /users/logout` locally | Remote priority snapshot uses POST; inspect current authentication.routes.ts |
| Legacy external token | `GET /users/create_external_token/:email` locally | Not the service-protected POST described by the remote snapshot; inspect current route and consumer |
| Local service support issuer | `GET|POST /internal/support-login-tokens` | Current src/app.ts mount; controller checks the internal service key |
| External grant exchange | `POST /users/external_auth` | external/support flow |
| Email-link landing | `GET /users/email-login` | separate long-lived email-link flow |
| Email inspect/exchange | `POST /users/email-login/inspect`, `POST /users/email-login/exchange` | `cmmsF` email-login screen |
| Email grant administration | `GET /users/email-login/credentials`, `POST /users/email-login/revoke`, `POST /users/email-login/revoke-user` | authenticated credential management |
| Internal email-link issuance | `POST /internal/email-login-tokens` | verify issuer authentication and mail path |
| Domain routes | `/master`, `/work`, `/reports`, `/map`, `/notifications`, `/knowledge-base`, `/upload` | protected under `isAuthenticated` outer mount |
| Knowledge base | `GET /knowledge-base/guides`, `GET /knowledge-base/guides/:id/file` | published content only |

## Internal API (`Internal_ExpressJS`)

Local `src/app.js` mounts `/api/users`, `/api/public`, `/api/internal`, and `/api/cmms`. The `/api/service/support-login` mount belongs to the remote priority snapshot and is absent locally. `priority/bugs` uses `auth + requireInternalCsrf` on internal routes and `cmmsAuth + requireInternalCsrf` on CMMS routes.

| Route family | Verb/path | Notes |
|---|---|---|
| Internal account and employee modules | `/api/internal/users`, `/api/internal/role-menu`, `/api/internal/assigned-companies` | nested routes, verify verbs and exact leaf path |
| Business modules | `/api/internal/invoices`, `/api/internal/sales-leads`, `/api/internal/sap-mappings`, `/api/internal/blogs`, `/api/internal/uploads` | do not bypass role grants |
| Internal KB publisher | `GET|POST /api/internal/knowledge-base/guides` | `GET` list, `POST` upload |
| Internal KB edit | `PUT /api/internal/knowledge-base/guides/:id` | optimistic concurrency via `updatedAt` |
| Internal KB publish toggle | `PATCH /api/internal/knowledge-base/guides/:id/visibility` | update and audit rights |
| Internal KB deletion | `DELETE /api/internal/knowledge-base/guides/:id` | remove metadata and managed files |
| Internal -> CMMS privileged flows | `/api/cmms/master`, `/api/cmms/work`, `/api/cmms/users`, `/api/cmms/mapping` | server-selected DB/tenant |
| Remote support-login snapshot | `POST /api/cmms/support-login` | Absent from local Internal mounts; do not implement a consumer assuming it exists |

## Client integrations

- `presageInternal` `src/app/services/api.service.ts` sends `x-db-type` for CMMS operations; this is a *request*, not authorization. `Internal_ExpressJS` must validate environment and company assignment server-side.
- `cmmsF` `src/app/core/services/pages/user/user.service.ts` calls email-link inspect/exchange with `withCredentials: true`.
- Both frontends use distinct base URLs and interceptors. Do not forward an internal JWT to arbitrary CMMS, processor, or third-party origins.
- Binary PDF responses use `responseType: 'blob'`; content transformation/crypto headers may be disabled intentionally for PDFs, not globally.

## Contract change checklist

For every modified route capture: method, full composed path, caller, authentication, principal, environment, account scope, request schema, response schema, status/error semantics, permissions, side effects, retry behavior, tests, and roll-out ordering. See [CONTRACT-CHANGE-CHECKLIST.md](CONTRACT-CHANGE-CHECKLIST.md).
