# Data model and source-of-truth ownership

> Local installation: read [CURRENT-WORKSPACE.md](CURRENT-WORKSPACE.md) first. This downloaded document describes inspected remote branch snapshots; current local source, package scripts and owning AGENTS.md take precedence. Paths and security controls below must be re-traced on the active branch.

| Entity group | Primary code locations | Cross-system concern |
|---|---|---|
| Customer accounts, features, subscriptions | `backend_express/src/modules/company`, `Internal_ExpressJS/src/cmms/master/company` | Internal admin changes customer-facing entitlements; audit and invalidate |
| Customer users and role menu | `backend_express/src/modules/users`, internal CMMS user administration | User status, tenant and role consistency |
| Internal staff and role menu | `Internal_ExpressJS/src/internal/user`, `internal/role-menu` | Separate staff authorization, not CMMS customer role |
| Assigned customer companies | `Internal_ExpressJS/src/internal/assigned-companies` | Environment+company membership and least privilege |
| Assets, locations, mappings | `backend_express/src/modules/assets`, `locations`, `mappings` | Account and resource-level scope |
| Work orders, requests, procedures, SOPs | `backend_express/src/modules/work-orders`, `maintenance` | State, assignees, parts and side effects |
| Parts/inventory and scheduled work | `backend_express/src/modules/inventory`, `src/core/scheduler` | Atomicity and idempotency |
| Internal sales/invoices/SAP | `Internal_ExpressJS/src/internal/sales-lead`, `invoice`, `sap-mapping` | Staff grants, currency, external identifiers |
| Knowledge-base guide metadata | `Internal_ExpressJS/src/internal/knowledge-base`, read via CMMS backend | Publication state, mirrored files and optimistic locking |
| Token sessions and email credentials | Each backend's auth/token modules; CMMS email-login model | Distinct token purpose, expiry and revocation |

Never copy a model file between repositories without checking collection name, owning connection, indexes, uniqueness, serialization transform, tenant filter and migration/release impact. For multi-document updates assess transaction/session availability and rollback semantics.
