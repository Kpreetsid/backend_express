# Error and response contracts

> Local installation: read [CURRENT-WORKSPACE.md](CURRENT-WORKSPACE.md) first. This downloaded document describes inspected remote branch snapshots; current local source, package scripts and owning AGENTS.md take precedence. Paths and security controls below must be re-traced on the active branch.

## Typical HTTP semantics

| Status | Meaning in this suite | UI behavior |
|---|---|---|
| 400 or 422 | Invalid input or validation | Show safe field-level or action-level message; no automatic retry |
| 401 | Missing/expired/invalid identity | Clear stale session/refresh under documented flow; don't loop |
| 403 | Authenticated principal lacks grant | Show permission denied; don't redirect indefinitely to login |
| 404 | Scoped resource absent/unavailable | Avoid confirming resource existence in another tenant |
| 409 | Concurrent edit or duplicate action | Offer refresh/retry after reading latest revision |
| 410 | Expired/revoked link, where route uses it | Offer normal login; do not leak token claims |
| 429 | Rate-limited | Respect Retry-After where present and avoid retry stampede |
| 5xx | Unexpected server/integration failure | Stable generic message; log correlation id without secrets |

## Contract trace

Server errors originate from Express middleware; browser errors pass through Angular HTTP/interceptors and feature components. The CMMS API and internal API may have different response fields and error mapping. Preserve expected `{status, message, data}` where used, but do **not** force every binary/stream endpoint into a JSON envelope.

## Agent requirements

1. Validate before DB side effects; assign 4xx vs 5xx correctly.
2. Normalize only well-understood error classes. Do not surface stack traces, JWT, SMTP contents or DB connection details to users.
3. Treat empty list differently from missing single item when contract requires that distinction.
4. Verify that an interceptor doesn't turn a real 403 into logout or infinite retry.
5. Verify duplicate request/retry behavior, especially order creation, email-link exchange, invoice submission and schedule jobs.
6. For contract changes, update frontend consumer, backend error middleware/handler and negative tests together.
