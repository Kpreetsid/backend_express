# Release safety for a four-repository change

> Local installation: read [CURRENT-WORKSPACE.md](CURRENT-WORKSPACE.md) first. This downloaded document describes inspected remote branch snapshots; current local source, package scripts and owning AGENTS.md take precedence. Paths and security controls below must be re-traced on the active branch.

## Release planning

1. List *exact* changed repositories, branches, SHA, environment and owner of approval.
2. If API change is backward-compatible: deploy backend first, then frontend after smoke test.
3. If API change breaks compatibility: use temporary dual-format support or a versioned endpoint; never rely on simultaneous release without a rollback plan.
4. For permission/role changes: ensure server denial is active before enabling frontend affordances; verify stale clients cannot retain access.
5. For support/email links: verify issuer and consumer compatibility across environments without transmitting real secrets into logs.
6. For KB publishing: verify both publisher and customer reader point to the same intended database and authorized PDF storage/mirror.
7. For cache/service worker deployments: verify stale client behavior and update/reload plan.

## Smoke test matrix

- Customer login and logout, permissions, selected CMMS feature, report and attachment access.
- Internal login, staff role check, assigned-company/environment switching.
- Support login to a non-production test account, proper denial to unassigned environments.
- Knowledge-base publish and customer read in controlled test environment.
- Work order creation + change + read with same account, denial with another account.
- Logs/errors redact passwords, JWTs, service keys and file bytes.

## Rollback

Document prior frontend artifact and backend build, DB migration reversibility, cache expiry, in-flight queue compatibility and links issued under new key/TTL. If rolling back a security fix, preserve fail-closed behavior. Do not perform production deployment without explicit user approval.
