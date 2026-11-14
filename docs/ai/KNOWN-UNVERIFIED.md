# Limits and verification prompts

These are scope notes, not security findings.

- Local inspection targeted feature/two-step-auth at d55f2b46. Other-branch vulnerabilities/tooling claims were not transferred as current findings.
- No application compilation, test suite, endpoint smoke test, DB/Redis/SMTP connection, mail send or deployment was performed for this instruction-only setup.
- Targeted test:* scripts exist; no general test/lint script. They do not establish complete repository or two-step coverage.
- A local lockfile exists but is ignored/untracked. Installed versions and cross-machine reproducibility need separate verification.
- Build invokes undeclared shx through npx; shx was absent in the inspected node_modules. ts-node is transitive rather than directly declared. No Node engine/version pin is supplied. Clean-machine installation/build compatibility remains unverified; no dependency changes were made for this audit.
- Auth, CSRF, crypto, authenticated files, permission versions and cache invalidation exist in source; that does not prove security across every route.
- withTransaction can rerun callbacks without a session on unsupported topology. Atomic rollback, retries and external effects need tests for the deployment.
- Idempotency/sync versions are route/model specific, not global exactly-once delivery or a complete frontend offline queue.
- Two-step uses atomic store operations and injected test seams. Concurrency, delivery failures, policy changes and final session issuance need relevant tests before changing guarantees.
- Cron uses 15 0 * * * without an explicit timezone option. The scheduler has an atomic persisted lease, but occurrence-level deduplication, stale loaded schedule state, lease expiry and crash recovery still need operational context/tests.

Resolve prompts with current source and reproducible evidence; keep guides/reference copies synchronized.
