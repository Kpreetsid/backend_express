# Pull request and implementation review checklist

For every review, produce findings **ordered by severity**, each with file/path, evidence, user impact, and suggested fix. If no findings, say what scope was reviewed and which tests remain unrun.

## Checks for the affected change

Apply relevant items to the actual scope and mark others not applicable. Instruction-only changes need metadata/discovery, local path/link and reference-copy consistency, scope and whitespace checks; they do not require tracing an arbitrary route or starting the application. A source-only review does not establish test or runtime success.

- [ ] Branch and commit are known; current source/versions take precedence over archived branch assumptions.
- [ ] Full HTTP route mount, exact path/method, middleware order and handler are traced.
- [ ] Request validation covers body/query/path/files; rejects malformed ID and disallowed fields.
- [ ] Authentication checks token signature and state; authorization checks role and object ownership.
- [ ] Tenant/account predicates apply to reads, nested loads, aggregations and writes.
- [ ] Models preserve collection names, soft deletes, status enums, ID transforms and indexes.
- [ ] Error handler does not return secrets, query details, stacks or untrusted filenames.
- [ ] Upload destinations and static serving enforce allowlists, containment and auth.
- [ ] Scheduler/mail work is retry-safe, idempotent, bounded and testable.
- [ ] Redis/session/cookie/CSRF interactions tested when affected.
- [ ] Frontend contract and deployment base path preserved or coordinated.
- [ ] No secrets, production data, live URLs with credentials or customer uploads in diff.
- [ ] Safe tests run; failures and NOT RUN reasons disclosed; no unsupported claims.
- [ ] Deployment/CI changes clearly authorized; no automatic push/merge made.

## Suggested output

1. **Findings:** severity, path/line, proof, impact, recommendation.
2. **Verification:** commands, observed outcome, missing checks.
3. **Open decisions:** exact required backend/frontend contract and production risks.
