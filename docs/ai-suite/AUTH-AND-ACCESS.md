# Authentication, session and permission flows

> Local installation: read [CURRENT-WORKSPACE.md](CURRENT-WORKSPACE.md) first. This downloaded document describes inspected remote branch snapshots; current local source, package scripts and owning AGENTS.md take precedence. Paths and security controls below must be re-traced on the active branch.

## Customer CMMS

- Entry: `cmmsF` customer login, refresh/auth interceptors and guards.
- Remote priority server map uses `src/core/auth/auth.middleware.ts`. Local CMMS_API uses `src/user/` and its current app/router middleware; trace that checkout rather than importing remote paths. Confirm where effective permissions are constructed.
- Apply both account-level feature entitlements and user role action grants. Frontend UI hints do not authorize backend operations.
- Treat access cookies, refresh tokens, external support grants, and reusable email-login credentials as separate token types with distinct issuer/purpose, expiry and revocation.
- On failed refresh or revoked session, clear account-specific client state and avoid cross-tab stale-session reuse.

## Internal staff

- Entry: `presageInternal` login, `UserService`, `TokenInterceptor`, `AuthGuard` and role menu UI.
- Local Internal identity is verified in `src/auth.js`; it sets `req.user`, while `req.db_type` is selected from client-controlled `x-db-type`. Inspect current route-specific action/company/environment checks independently. The remote `src/middlewares/internal-permission.js` path must not be assumed present.
- Explicit internal role-menu denials are meaningful; never assume administrators can override them unless the active route implements that policy.
- Internal authorization and CMMS privileged resource access are two separate checks.

## Critical negative cases for Codex

1. No credentials or invalid signature -> 401; do not expose internal internals.
2. Signed-in but feature/action denied -> 403.
3. Valid user, wrong company/tenant or unassigned environment -> 403/404 by existing API contract, never leak data.
4. Expired/revoked grant -> fail closed, no exchange or redirect.
5. Stale browser state and in-flight request after account switch -> old requests must not end new session or reuse stale authorizations.
6. Service-to-service calls require explicit service key/identity and validated actor, never an arbitrary browser header.

Read [SECURITY-AND-TENANCY.md](SECURITY-AND-TENANCY.md) and source files before changes. Do not print tokens, cookies, passwords, mail credentials or database strings in output/test snapshots.
