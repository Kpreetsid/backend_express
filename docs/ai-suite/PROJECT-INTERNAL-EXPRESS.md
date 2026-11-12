# Repo guide: Kpreetsid/Internal_ExpressJS (staff and privileged CMMS API)

> Local installation: read [CURRENT-WORKSPACE.md](CURRENT-WORKSPACE.md) first. This downloaded document describes inspected remote branch snapshots; current local source, package scripts and owning AGENTS.md take precedence. Paths and security controls below must be re-traced on the active branch.

## Purpose and core API mounts

ESM JavaScript Express 5 backend. Local `src/app.js` mounts `/api/users`, `/api/public`, `/api/internal` and `/api/cmms`; `/api/service/support-login` is a remote-snapshot mount absent locally. Internal staff workflows include users, role menus, assigned companies, blogs, invoices, sales leads, SAP mapping, uploads and knowledge-base publisher. Privileged CMMS routes include customer company, user, work, mapping and support-login administration.

## Auth and environment isolation

- `src/auth.js` authenticates internal user and session context.
- `priority/bugs` adds `src/middlewares/cmms-auth.js`, `internal-csrf.js`, `internal-permission.js`, `authorization.js` and environment-context controls.
- CMMS staging and production databases are separate; connection choice must be authorized server-side and scoped to the staff user's assigned customer companies.
- Explicit staff permission does not automatically grant unrestricted customer data access.

## Key integrations

- Remote snapshot only: `POST /api/cmms/support-login` -> `SupportLoginService` -> customer CMMS POST grant issuance. This chain is absent from local Internal mounts. The local service issuer in CMMS_API is GET/POST `/api/internal/support-login-tokens`; inspect the current consumer and controller.
- Internal knowledge-base publisher performs metadata writes and PDF storage/mirroring with action checks and optimistic revisions; customer reader endpoint exists in `backend_express`.
- Internal invoice/sales-lead/SAP endpoints have their own validators, permissions and business-state rules.

## Commands

`priority/bugs`: `npm test`, `npm run test:security`. `master`: `npm test` present. Use built-in Node test runner; JavaScript ESM import paths must include `.js` consistent with the repository.

Testing a company-management operation requires negative cases for forbidden staff action, unauthorized environment and cross-tenant target, including updates to related role/feature data.
