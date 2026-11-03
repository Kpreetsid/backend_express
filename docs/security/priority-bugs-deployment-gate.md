# CMMS staging deployment gate — 2026-10-29

Target: `priority/bugs` only. This is a release checklist, **not proof of production readiness**.

## Explicit scope
- Preserve CMMS-001 as an intentional application capability; review it under its separate product requirements.
- Backend application: Express 5; frontend: Angular 16. The backend and frontend branches have independent release pipelines.
- Never deploy from a branch with red or pending CI.
- Do not merge or deploy automatically solely because a commit is present.

## Release-blocking verification
1. `npm ci`, typecheck, security tests, full unit tests, and production build must all succeed for both repositories. Retain immutable workflow-run links and commit SHAs.
2. Replace `xlsx@0.18.5` with a vetted patched upstream release; official SheetJS docs describe `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`. Generate **and audit** the matching lockfile with a networked CI runner; do not hand-author integrity hashes. Verify Excel import/export compatibility.
3. Retest CMMS-004: private file read requires authenticated tenant AND resource ownership. Existing filename-prefix checks must not be treated as a complete object-level authorization policy. Assess legacy uploads and migration.
4. Retest CMMS-005/006: cookie CSRF, cross-origin iframe flows, upload folder permission, upload owner validation, and CORS Origin allowlisting under real browser sessions.
5. Confirm that monitoring IP allowlisting uses the **direct connection peer** and that `CMMS_MONITOR_IPS` contains only verified internal proxy/monitor addresses. Nginx must block external access to `/metrics` and `/health/ready`.
6. Restrict Node inspector and Mongo/Redis connectivity to loopback or private interfaces; verify credentials and TLS, HTTPS redirects, HSTS and headers at the ingress.
7. Confirm cookie SameSite, Secure, Path and host-only settings in actual Chrome iframe use, including CSRF protection for logout and other state-changing operations.
8. Deploy to an isolated staging instance, run authenticated API negative tests, audit cross-tenant object IDs, validate rollback, and execute production-like smoke tests.
9. Do not approve production until all known High/Critical defects not explicitly accepted by the owner have verified fixes and a recorded reviewer sign-off.

## Nginx control (example only)
```nginx
location = /metrics { return 404; }
location = /health/ready { return 404; }
```
If an internal health monitor requires these paths, expose them through a separate private listener or an independently authenticated internal route. Ensure the proxy does not permit bypass via alternate URL prefixes.

## Deployment evidence
Record environment, branch, commit, CI run, dependency audit, reviewer, date, smoke-test result and rollback command for each release. Never commit production secrets, environment files or customer data.
