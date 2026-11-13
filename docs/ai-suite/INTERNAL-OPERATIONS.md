# Internal operations and administration

> Local installation: read [CURRENT-WORKSPACE.md](CURRENT-WORKSPACE.md) first. This downloaded document describes inspected remote branch snapshots; current local source, package scripts and owning AGENTS.md take precedence. Paths and security controls below must be re-traced on the active branch.

## Internal frontend feature inventory (`presageInternal`)

- `pages/account-management` - account list, detail, updates and account permissions.
- `pages/user-management` - employee/user lifecycle and password/session-related administration.
- `pages/admin-panel` - staff users, role menu and assigned customer companies.
- `pages/knowledge-base` - guide authoring, publishing and PDF preview.
- `pages/sales-lead-tracker` - leads and pipeline interactions.
- `pages/invoice-tracker` - invoice tracking, finance/export.
- `pages/sap-mapping` - SAP mapping workflows.
- `pages/blog` - internal content creation.
- `pages/gateway`, `devices`, `sensor`, `alarm`, `rms-results`, `rsm-data`, `data-lookup` - technical/operational dashboards and data lookups.
- `pages/cron-job`, `loc-testing-report`, `assets-details`, `user-control` - operational/admin tooling; inspect exact endpoints before changes.

## Internal backend feature inventory (`Internal_ExpressJS`)

- `/api/internal` mounts users, blogs, uploads, role-menu, assigned-companies, invoices, sales-leads, sap-mappings, knowledge-base.
- `/api/cmms` mounts master, work, users, mapping and support-login privileged customer operations.
- `src/cmms/master/company` contains account management and cross-system permission/credential auditing.
- `src/_db` owns multiple Mongo connection abstractions; website and customer CMMS connections have distinct trust/scope.

## Cross-application admin flows

1. Staff account permission change -> internal backend write with authorized actor -> customer API access/permissions in the correct CMMS environment -> customer frontend refresh/invalidates role menus.
2. Staff user/company assignment -> only authorized environment/customer; reject forged company ID, wrong staff role and cross-tenant access.
3. Sales lead and invoice modifications -> validation plus internal action grant, ownership/visibility and currency/date correctness.
4. Knowledge-base content -> publisher API; never add a customer-side publisher endpoint.
5. Operational reports -> verify internal versus CMMS backend data source and avoid inadvertent production/staging mixing.

## UI development guidance

Use `presageInternal/src/app/app-routing.module.ts` for route wiring. The app uses an NgModule bootstrap with many lazy `loadComponent` routes, SSR and hydration. Inspect current Angular version before replacing reactive patterns. Client role-menu visibility remains a convenience, not an authorization boundary.
