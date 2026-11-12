# Authentication, permissions and tenant isolation

## Local source map

- src/_config/auth.ts exposes authenticateTokenContext/isAuthenticated and verifies tokens/session state, user/account/role context and effective permissions. Trace Redis session lookup and Mongo fallback before editing.
- src/_role/ and src/middlewares/permission.ts own effective access and role checks. Authenticated mounts do not replace per-operation/object authorization.
- src/user/authentication/ owns login, refresh, logout and cookies; src/middlewares/csrf.middleware.ts, src/_config/cors.ts and payloadCrypto.middleware.ts have separate policies. Preserve ordering and applicable exemptions.
- Email/support credentials are separate flows; see EMAIL-LOGIN-TOKENS.md. An internal route's name is not authorization.

Use signature verification, configured algorithms/issuer/audience, expiry and current session/user/account state for authorization. jwt.decode alone is not verification. Preserve revocation, password/session invalidation and account-permission versions. Treat caller IDs, headers, roles and redirects as untrusted until verified.

Scope reads, writes, joins, cached responses and events by account/object access. Test anonymous, wrong account, forbidden role, inactive identity, expired/revoked/tampered token, stale permissions, refresh/logout and replay where affected. Never log tokens, OTPs, cookies, passwords or credential-bearing URLs. Existing safeguards need tests; this is not a security audit pass.

## Two-step password login

src/user/authentication/authentication.routes.ts mounts POST /users/two-step/verify and /users/two-step/resend with distinct rate limiters and no-store headers. Inspect authentication.service.ts/controller.ts for initial issuance and response modes. src/user/two-step/ contains service, model, controller and mail adapter.

createTwoStepService accepts an injected store, clock, secret, code generator, user/account loaders and sender. Use these seams for isolated tests. The Mongo store uses versioned compare-and-set; validity checks current account policy revision, credentials and active identity. Digests, delivery states, consumption and attempt/send budgets are contracts. TTL cleanup is not expiry enforcement.

A pending twoStepRequired response must not initialize a session. The verification controller consumes a challenge, rechecks eligibility, then completes the existing cookie/localStorage response mode and refresh/session setup. Preserve compatibility and no-store behavior. Keep password change and account policy revision invalidation intact.

Test missing/malformed/expired challenge, wrong code, cooldown/resend, failed mail, changed credentials/policy, concurrent consumption, replay and successful completion. Assert no auth cookies/session before verified completion. Read current constants for durations/limits; changing them is a policy change, not incidental cleanup.

## External, email and support session boundary

The shared establishExternalSession function in authentication.service.ts checks current account two_step_auth_enabled before role creation, tokens, refresh/session persistence or cookies. When enabled it returns 403 with TWO_STEP_PASSWORD_LOGIN_REQUIRED, directing the user to password plus email verification. Email exchange and both legacy/support external authentication call this boundary. Preserve this gate rather than treating possession of another login credential as completed two-step verification; verify each affected entry path and policy-change race with isolated tests.

## Account policy administration

`src/masters/company/company.routes.ts` mounts GET/PATCH `/two-step-auth` under the company path; `two-step-settings.controller.ts` owns exact-admin access, authenticated account scope, payload validation and policy revision/audit updates. Enabling requires the existing TWO_STEP_AUTH_SECRET prerequisite; never expose the secret. The policy applies to subsequent password logins and does not force existing sessions to log out. Preserve this explicit behavior rather than silently adding session revocation. The Angular account-security UI must not treat a selected admin-panel user as the policy owner.
