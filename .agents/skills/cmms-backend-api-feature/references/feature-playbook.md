# Feature implementation playbook

## Investigation

1. Confirm branch and repo status. Translate task into observed behaviors and explicit acceptance criteria.
2. Trace actual HTTP route registration from `src/app.ts` through group and module routers. Write the full method/path and auth stack.
3. Read controller, service, model, role permission, express-validator/ID validation and related side effects. For an affected shared contract, inspect accessible Angular consumers after reading their project guide. A cross-project feature authorizes its necessary local API/UI changes; do not require a second authorization solely because they live in separate repositories.
4. Record status codes, response envelope, tenant filtering, idempotency needs, file/data retention, and backward compatibility.

## Design

1. Write mini-contract: method/path, auth, role, tenant, request DTO/validation, response envelope, errors (400/401/403/404/409/422/500 as applicable).
2. Select existing module and file locations. New feature under adjacent `src/masters/*`, `src/work/*`, `src/user/*`, `src/reports/*` or another verified existing module; do not make a new framework.
3. Decide whether schema changes require backfill/index/migration and rollback. Avoid deleting production data.
4. Plan tests for the affected behavior before implementation: success and relevant malformed input, anonymous, wrong tenant, forbidden role, missing record, duplicate requests or unexpected DB failure cases. For instruction-only changes validate paths, links, reference consistency and whitespace without starting the application.

## Implement

1. Update the narrowest existing model/validation/service/controller/route set, maintaining authenticated boundaries.
2. Use DB-level account filters even when middleware checks account; verify role permissions on mutation routes and sensitive reads.
3. Keep new tokens, file paths and dynamic queries out of logs and error payloads.
4. For multi-service writes (work orders + users + inventory + email), design atomicity or compensating behavior; avoid partial success without user feedback.
5. For scheduled side effects, ensure duplicate execution prevention at persistence level, not only in process memory.

## Verify and report

1. Run safe branch-supported checks, then test with isolated DB fixtures or mocks; never use production by accident.
2. Examine diff, imports, route priority, middleware order and output compatibility.
3. Report files changed, contract impact, checks `PASS/FAIL/NOT RUN`, security/tenant verification, and remaining uncertainty.
4. Do not push/merge/deploy without authorization.
