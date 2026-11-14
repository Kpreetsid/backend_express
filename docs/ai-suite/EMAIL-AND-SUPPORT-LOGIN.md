# Two distinct cross-application login flows

> Local installation: read [CURRENT-WORKSPACE.md](CURRENT-WORKSPACE.md) first. This downloaded document describes inspected remote branch snapshots; current local source, package scripts and owning AGENTS.md take precedence. Paths and security controls below must be re-traced on the active branch.

## Local support-login routing

The installed Internal frontend currently calls GET `/api/users/create_external_token/:email` directly. CMMS_API separately mounts GET/POST `/api/internal/support-login-tokens`; inspect service-key and actor/account checks there. The Internal backend does not mount the proxy flow described below. Treat that chain as a remote snapshot, not an implemented local integration.

## A. Remote priority support-login snapshot (not mounted locally)

1. `presageInternal` obtains an internal staff session; `src/app/services/support-login-state.ts` generates a cryptographically random state challenge.
2. Its API service calls `POST /api/cmms/support-login` at `Internal_ExpressJS`, passing selected environment, intended customer and challenge.
3. `Internal_ExpressJS` checks internal actor authorization/assigned-company/env and calls the matching CMMS API `POST /api/users/create_external_token` with a configured service key.
4. `backend_express` validates service identity and external access grant; CMMS UI handles the external-login flow.
5. Tests must cover actor mismatch, missing/invalid challenge, wrong environment, replay, expired grant, wrong account and leaked URL tokens.

**Do not** treat this as a general login bypass or share a staff session cookie with the customer app. Source: internal support service and backend authentication routes.

## B. CMMS email-login links

1. Backend issue route: `POST /api/internal/email-login-tokens` (verify service authentication in handler).
2. Link format uses customer application `.../email-login#token=...` rather than a query token.
3. `cmmsF` extracts fragment token into memory, removes the fragment promptly, calls `POST /api/users/email-login/inspect` and then `exchange`.
4. For a different logged-in identity, client asks before switching; backend validates identity, account, expiry, revocation and destination.
5. Backend stores token digest and credential metadata and supports revocation endpoints.
6. Destination must be a safe internal path; no open redirects or authorization bypass by deep link.

## Observed TTL: verify product requirement

The **`priority/bugs`** file `src/modules/auth/email-login/email-login.service.ts` defines `EMAIL_LOGIN_TTL_SECONDS = 604800` (7 days). That is an observed source constant, **not** proof of the agreed product lifetime. Do not describe it as one year or silently change it. Confirm desired duration/security policy explicitly before implementing a TTL change; then test issue, inspect, exchange, repeat use, revoke and expiry.

## Branch caution

`backend_express/main` has older token routes; `feature/email-login-links` and `priority/bugs` have different folder structures. Reconstruct method and path on the actual checked-out branch. Avoid adding duplicate legacy `/api/users/email-login` implementations.
