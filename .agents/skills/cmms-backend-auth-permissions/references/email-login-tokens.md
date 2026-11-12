# Email login, support login and token flow

## Current local route map

src/nonAuthRoutes.ts calls registerEmailLoginRoutes. src/user/email-login/email-login.routes.ts registers POST /internal/email-login-tokens, GET /users/email-login/, POST /users/email-login/inspect and /exchange, plus authenticated credential listing/revocation. Resolve API aliases through src/app.ts. Internal issuance authorization is in handlers/services; public router registration does not prove unrestricted issuance.

src/user/support-login/support-login.routes.ts mounts at /internal/support-login-tokens inside the API router. src/user/authentication/authentication.routes.ts handles /users/external_auth, refresh and me. Keep support/email/password two-step policies distinct. Tests exist beside email/support services; inspect mocks/imports before running them.

Current email credentials have a seven-day lifetime (EMAIL_LOGIN_TTL_SECONDS) and exchange updates lastUsedAt/useCount; do not assume one-time consumption. The shared establishExternalSession boundary rejects email, legacy and support session creation with 403/TWO_STEP_PASSWORD_LOGIN_REQUIRED when the current account enables two-step authentication. Preserve this account-policy gate and use the password verification flow in that case. Recheck current source before changing lifetime, reuse or session policy.

## Agent workflow

1. Trace issuance -> storage -> delivery -> inspection -> exchange -> session creation -> deep-link -> revocation for one intended recipient/account.
2. Verify signature / strong random credentials, purpose and recipient binding, issued/expiry timestamps, revocation, allowed usage count/reuse policy and rotation. Use the user's explicit lifetime/reuse requirements when supplied; ask only for a missing decision that materially changes the contract. Never infer policy from token format or imported sample prompts.
3. Do not put raw credentials in query strings, access logs, analytics, referrals, issue discussions or email previews. If frontend expects `#token=...`, ensure fragment is stripped from browser history before any network calls; never treat a fragment as protection against malicious scripts.
4. Keep inspection responses minimal; don't disclose whether arbitrary emails/accounts exist. Add rate limiting, auditing of safe metadata and abuse detection.
5. Preserve the actual frontend account-switch confirmation and stale-session handling contract; do not invent a new confirmation requirement. Follow the approved return URL restrictions and preserve tenant isolation on exchange.
6. Test expired, revoked, tampered, already-used, cross-account, wrong recipient, replay, concurrent exchange and invalid redirect cases.
7. Do not silently repurpose access JWTs as long-lived email credentials; use purpose-specific storage and verifier with documented policy.

## Integration boundary

The Angular frontend is a separate repository. Verify consumer path, cookies/CSRF, redirect and contract with the actual frontend branch rather than relying on a sample string or another project.
