# Known uncertainties, inconsistencies and evidence limits

> Local installation: read [CURRENT-WORKSPACE.md](CURRENT-WORKSPACE.md) first. This downloaded document describes inspected remote branch snapshots; current local source, package scripts and owning AGENTS.md take precedence. Paths and security controls below must be re-traced on the active branch.

This is an investigation register, not a verified bug list.

| Item | Evidence / ambiguity | Required Codex action |
|---|---|---|
| Branch drift | CMMS default branches and `priority/bugs` use different source trees; internal Angular shifts 18 -> 20 | Choose current branch first; map source paths from checkout |
| Email-link lifetime | `backend_express/priority/bugs` `EMAIL_LOGIN_TTL_SECONDS = 604800` (7 days) | Confirm intended product duration; do not assume one year; test issue/reuse/revoke/expiry |
| Offline mutations | CMMS SW config caches shell/assets/i18n; persisted offline mutation replay not demonstrated by those files | Trace queue storage, replay, security and conflict policies before promising offline writes |
| Push delivery | Browser notification UI and backend notification route are present | Verify permission, subscription, transport and delivery in local test |
| Cross-DB leakage | Internal API exposes privileged CMMS and website DB connections | Review every route for server-enforced environment/company scope; test negative cases |
| Knowledge-base shared storage | Internal README describes mirrored PDFs and shared metadata | Verify deployed mount paths, access rights and rollback cleanup |
| Multiple API prefixes | CMMS API priority branch mounts `/api`, `/api/v1` and configured prefixes | Check frontend base URL/proxy to prevent duplicate path segments |
| Uneven test scripts | CMMS priority has `test:mcsa` with a tsconfig not seen in inspected tree | Inspect actual checkout and repair command separately if requested |
| Generic `ng lint` | Lint command configured in package may lack an architect lint target | Verify angular.json, do not claim lint success from invocation alone |
| Older `backend_express/main` test absence | No `npm test` script observed | Use typecheck and create safe targeted tests only if authorized |
| Runtime completeness | Repository tree + samples, not live configured environment | Report feature completeness only after running tests and integration checks |
| Deployment topology | `appspec.yml`/workflows/config can vary by branch | Inspect live manifest and explicit release controls before action |

Do not insert secrets or actual production user records in the knowledge base while resolving these gaps.
