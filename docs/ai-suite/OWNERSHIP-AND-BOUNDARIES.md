# Feature ownership and change routing

> Local installation: read [CURRENT-WORKSPACE.md](CURRENT-WORKSPACE.md) first. This downloaded document describes inspected remote branch snapshots; current local source, package scripts and owning AGENTS.md take precedence. Paths and security controls below must be re-traced on the active branch.

## Owner decision table

| Request | Primary owner | Possible secondary changes | Invariant |
|---|---|---|---|
| CMMS button/form/route | `cmmsF` | `backend_express` for contract | Guard and server authorization agree |
| Customer asset/order/maintenance data behavior | `backend_express` | `cmmsF` and possibly internal CMMS admin | Account scope and resource ownership |
| CMMS browser offline/cache/install | `cmmsF` | API only if sync contract changes | Do not cache personal data across users |
| Internal staff dashboard or admin screen | `presageInternal` | `Internal_ExpressJS` | Do not give browser new privilege |
| Internal employee role/assigned companies | `Internal_ExpressJS` | `presageInternal` | Explicit internal authorization |
| Access CMMS staging/production from internal | `Internal_ExpressJS` | `presageInternal` selection | Server enforces environment and assignment |
| Internal publisher knowledge base | `Internal_ExpressJS` | `presageInternal` and CMMS read path | Draft unpublished content stays restricted |
| CMMS customer reads published guide | `backend_express` | `cmmsF` | No publishing endpoint on customer API |
| CMMS email-login link issue/exchange | `backend_express` | `cmmsF` | Link token never becomes a URL query or log |
| Internal support access to CMMS | `Internal_ExpressJS` orchestrates | `backend_express`, `presageInternal`, `cmmsF` | Actor authority, environment, state challenge, short-lived access |
| Shared error / response contract | Backend owning endpoint | Consuming frontend | Specific status handling for 401/403/404/409/410/429 |

## Rules for overlapping modules

1. Search the caller, not only the similarly named module.
2. Identify exact HTTP base and URL. A UI may call the other backend, a processor API, or a third-party service.
3. Trace root router -> nested router -> validator -> permission -> controller -> service -> model.
4. Identify identity principal and tenant (`account_id`, selected company, authenticated user, `req.db_type`).
5. Confirm origin of truth; do not introduce a duplicate mutable copy in the other repo without an explicit synchronization contract.
6. Update both sides of a changed API contract in one coordinated plan, even if delivered in separate commits.
