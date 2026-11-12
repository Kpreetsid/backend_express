# Security invariants: tenant, environment, roles, URLs and files

> Local installation: read [CURRENT-WORKSPACE.md](CURRENT-WORKSPACE.md) first. This downloaded document describes inspected remote branch snapshots; current local source, package scripts and owning AGENTS.md take precedence. Paths and security controls below must be re-traced on the active branch.

## Strict boundaries

1. Derive principal identity from verified server authentication, never `userId` supplied by the browser.
2. Scope database filters, updates, aggregation joins and file fetches to authenticated account and authorized resource.
3. On internal CMMS operations, validate `x-db-type` and user/company assignment *on the server*. `production` must never be an accidental fallback for a rejected staging request.
4. Bind models to the selected Mongoose connection; never mix staging and production models during a request.
5. Check explicit permission by feature and action (`view`, `add`, `edit`, `delete`, `import`, `export`) at the backend; role-menu UI alone is advisory.
6. Validate body, query, route IDs, file size/signature/MIME, and document update revisions.
7. Use prepared/allowlisted destination paths for downloaded files, safe content-disposition, and forbid path traversal and symlink escape.
8. Restrict JWT forwarding to configured trusted API origins; no token in URL query, logs, analytics or referrer.
9. Browser `#token=` may be used for designated email-login entry only, removed from the address bar before network calls; do not persist raw grant in local storage.
10. Make background jobs and webhook/service calls idempotent and explicitly tenant aware.

## Source anchors

- `Internal_ExpressJS`: `src/middlewares/environment-context.js`, `src/middlewares/internal-permission.js`, `src/middlewares/cmms-auth.js`, `src/auth.js`, `src/_db/index.js`.
- `backend_express`: `src/core/auth/auth.middleware.ts`, `src/modules/users/services/account-access.service.ts`, route permission middleware.
- `presageInternal`: `src/app/services/token-request-policy.ts`, `src/app/services/internal-permission-policy.ts`.
- `cmmsF`: auth/refresh interceptors, authorization service, account permission sync.

## Threat-oriented tests

Probe cross-tenant read/write, forged client company ID, environment downgrade, unassigned company, expired JWT, stale access token, revoked email credential, HTML/JavaScript disguised as PDF, directory traversal, CSRF, CORS origin, role-menu missing/denied, double execution, repeat submission and malformed ObjectId. Assert *no side effect* on denial.

Never modify production credentials, deployment environment or live user records during documentation or code generation. Do not embed secrets in prompt files.
