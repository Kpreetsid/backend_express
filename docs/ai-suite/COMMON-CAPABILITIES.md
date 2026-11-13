# Shared capabilities and deliberate differences

> Local installation: read [CURRENT-WORKSPACE.md](CURRENT-WORKSPACE.md) first. This downloaded document describes inspected remote branch snapshots; current local source, package scripts and owning AGENTS.md take precedence. Paths and security controls below must be re-traced on the active branch.

| Shared domain | Common requirements | Different implementation details |
|---|---|---|
| Identity/session | Authenticate principal, expire/revoke, handle 401 | CMMS and internal APIs have distinct sessions, cookies, endpoints and token models |
| RBAC | Default deny, action- and resource-level grants | CMMS account feature/role menu versus internal staff role menu |
| Tenant isolation | Bind every read/write to authenticated context | CMMS account IDs versus privileged internal `x-db-type` plus assigned-company controls |
| Uploads | File signatures/size/path/ACL, safe downloads | CMMS upload service, internal admin uploads, KB mirrored PDF |
| Workflows | Validate state transitions and record an audit trail | Customer orders/maintenance versus internal sales/invoice/SAP workflows |
| Reports | Type-safe filters, bounded queries, access control | CMMS report service/PDF versus internal finance/analytics exports |
| Notifications | Consent, subscription state, meaningful errors | Browser UI, backend mail and notification routes, no proof of full delivery stack |
| Error handling | Predictable codes, safe messages, no secret leakage | Express TypeScript and Express ESM error middleware differ |
| Testing | Test negative authorization cases and stale state | Karma/Jasmine frontend versus Node test runner / targeted TS Node tests |

## Avoid accidental convergence

- Do not force a single framework version, lint rule, validation library, cookie policy or ORM abstraction across the suite.
- Do not assume internal support login is identical to reusable email login; they have different issuers, audiences and security requirements.
- Do not assume a frontend guard grants server-side permission.
- Do not assume PWA service-worker caching implies persistent offline mutations.
- Do not treat source code presence as proof that an entire application feature is finished.
