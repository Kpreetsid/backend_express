# End-to-end workflows for Codex to trace

> Local installation: read [CURRENT-WORKSPACE.md](CURRENT-WORKSPACE.md) first. This downloaded document describes inspected remote branch snapshots; current local source, package scripts and owning AGENTS.md take precedence. Paths and security controls below must be re-traced on the active branch.

Use each row as a testable trace, not a guaranteed production transaction.

| Workflow | Start | Backends / shared boundaries | Required negative test |
|---|---|---|---|
| Customer login/logout | `cmmsF/features/auth` | CMMS auth routes and session model | Expired/revoked token; old tab after new login |
| Customer email deep link | `cmmsF/features/auth/email-login` | CMMS email-login inspect/exchange/revoke | Open redirect, wrong account, expired, repeat-use, revoked |
| Internal support access | Local INTERNAL_APP admin action | Legacy direct CMMS external-token GET; remote Internal `/api/cmms/support-login` proxy is absent locally | Inspect actual principal, company/environment and grant checks; do not assume remote safeguards |
| Customer feature permission | CMMS navigation/guard | CMMS account feature + user role | Forged route/API request despite hidden menu |
| Staff role menu | Internal admin-panel | Internal role-menu API | Explicit deny, invalid actor, permission escalation |
| Account entitlement change | Internal account-management | Internal CMMS company API, CMMS access service | Cross-tenant edit, stale permission state |
| Asset mapping | CMMS asset/location screens | CMMS assets/mappings API | Resource belongs to another account |
| Work-order create/assign | CMMS work-orders | CMMS work-order service + maps/parts | Duplicate create, unauthorized assign |
| Work-request conversion | CMMS work-requests | CMMS request/work-order service | Retry creates second work order |
| Preventive schedule | CMMS preventive screen | CMMS scheduler + work-order create | Duplicate midnight run/timezone drift |
| Inspection corrective work | CMMS inspections | CMMS maintenance/work-order services | Missing permission, invalid linked asset |
| Publish guide PDF | Internal knowledge-base UI | Internal publisher -> shared metadata/files -> CMMS read | Draft leaked, malformed PDF, stale update |
| View published guide PDF | CMMS knowledge-base UI | CMMS protected read-only API | Unpublished guide visible or private file leaked |
| Report download | CMMS report/ internal finance | Respective backend report/export | Cross-tenant export, malformed bytes |
| Notification event | CMMS notification UI | CMMS notification service, browser permission | Stale subscription/incorrect recipient |
| Production/staging switch | Internal UI environment selector | Internal API environment context and DB connection | Unauthorized environment, cross-env leak |

## Trace artifact expected per workflow

Record the user action, exact route path, headers, identity, permission, model/collection, side effect, response, error cases, relevant regression test, and deployment compatibility. A successful frontend click alone is insufficient evidence.
