# All-application feature and functionality matrix

> Local installation: read [CURRENT-WORKSPACE.md](CURRENT-WORKSPACE.md) first. This downloaded document describes inspected remote branch snapshots; current local source, package scripts and owning AGENTS.md take precedence. Paths and security controls below must be re-traced on the active branch.

**Legend:** `UI` = visible feature code identified in frontend; `API` = API/domain module or route identified; `Admin` = internal administration of the capability; `-` = no primary ownership identified. **No cell signifies runtime verification.** Based mainly on the four `priority/bugs` snapshots; earlier branches vary.

| Capability | cmmsF | backend_express | presageInternal | Internal_ExpressJS | Relationship |
|---|---|---|---|---|---|
| Sign in, session, logout | UI | API | UI | API | Independent auth stores and cookie/token policies |
| Signup, identity verification, recovery | UI | API | UI | API | Different user classes and backend contracts |
| External/support login | UI (`/external`) | API (external grant) | Admin UI flow | API (`/cmms/support-login`) | Privileged cross-app flow |
| Reusable email deep link | UI (`/email-login`) | API (inspect/exchange/revoke) | - | - | Customer CMMS email identity flow; separate from support grant |
| Account creation and maintenance | Limited customer context | API | Admin UI | API | Internal administrators influence customer entitlements |
| Customer role and permission administration | UI and route guards | API and access service | Admin UI | API through CMMS endpoints | Account-role contract across four apps |
| Internal staff / role menu | - | - | Admin UI | API | Internal permission model, not identical to customer permissions |
| Assigned companies / employee control | - | - | Admin UI | API | Gates privileged CMMS access |
| Assets / equipment and component hierarchy | UI | API | Asset lookup/UI | Privileged CMMS API | Shared business entities, different audience |
| Locations, floor maps, user mappings | UI | API | Data lookups | CMMS API | Account- and environment-scoped |
| Sensor/dashboard/health and diagnostic visualizations | UI | API/report and processor integration | Sensor/RMS/RSM views | CMMS/other integrations | Overlapping data consumption, not identical UI |
| Devices/gateways | UI | Integration routes | Admin UI | CMMS-related routes | Distinct operational/admin tooling |
| Alarms and threshold visibility | UI | Communication/observation modules | Admin views | CMMS modules | Verify source-of-truth per endpoint |
| Work orders (create/execute/status) | UI | API | Not primary | CMMS privileged operations | Core customer maintenance workflow |
| Work requests and conversion | UI | API | Not primary | CMMS privileged operations | Link requester, asset, assignee, status |
| Preventive scheduling / cron | UI | Scheduler/maintenance API | Cron-job UI | Related CMMS controls | Job execution only in backend; UI schedules alone not proof |
| Inspections and corrective work | UI | API | Related reports | CMMS API | Handle parent work and evidence safely |
| SOPs/forms/procedures/work instructions | UI | API | Knowledge-base authoring distinct | CMMS API | Do not conflate SOP with KB PDF publishing |
| Inventory, parts and quantity changes | UI | API | - | CMMS routes where present | Requires atomic/retry-safe handling |
| Reports, dashboards and downloads | UI | API/PDF | Admin reports, invoice exports | API | Distinct report formats and permissions |
| Notification center / browser messages | UI | API and messaging | - | Some administrative flows | Notification display not proof of end-to-end push |
| PWA install, offline screen and SW | UI | - | No equivalent confirmed | - | `ngsw-config.json` and offline UI; mutation queue separately verify |
| Knowledge-base guides | Read UI | Published read-only API | Publisher UI | Publisher API/storage | Proven split of publishing vs consumption |
| Upload and private documents | UI | Protected upload/file APIs | Upload UI | Admin uploads | Validate MIME, size, ACL, path, audit |
| Sales leads and interactions | - | - | UI | API | Internal sales feature |
| Invoices and revenue tracking | - | - | UI | API | Internal finance feature |
| SAP mapping | - | - | UI | API | Internal integration feature |
| Blog authoring | - | - | UI | API | Internal content management |
| Email process checks / staff ops | - | Mail service | Some branch UI | API/integration dependent | Do not assume feature parity by name |
| Tenant isolation / DB switching | Account context | Account-scoped API | Staging/production environment selector | Multi-DB access | High-risk cross-app invariant |
| Feature flags/subscriptions | Customer UI guards | Account access services | Account management UI | Company/role admin | Contract requires versioning and invalidation |
| Error handling and validation | Interceptors/UI | Middleware/validators | HTTP errors/UI | Middleware/validators | Consistent semantics, not necessarily identical payloads |
| Security logging/audits | Auth behavior | Logs/routes | Admin UI | Security audit modules | Never log token secrets or user-upload bytes |

## Interpretation

- The matrix is a **capability map**, not a claim that each cell is feature-complete.
- Prefer actual consumers and route registrations from [SOURCE-MAP.md](SOURCE-MAP.md), not names alone.
- A dash means no ownership was established during inspection; it does not prove absence.
- A named module may be incomplete, branch-specific or non-deployed. See [KNOWN-GAPS.md](KNOWN-GAPS.md).
