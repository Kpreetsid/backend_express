# Email login links

Email credentials are reusable for seven days and keep a server-saved destination. They are separate from five-minute, single-use support credentials. The caller sends the email; this API returns a link for its button.

## Configuration

| Setting | Use |
| --- | --- |
| `AUTH_SECRET` | Existing project secret, used directly for HS256 signing and verification. |
| `INTERNAL_LOGIN_SERVICE_KEY` | Dedicated caller key of at least 32 characters. Never put it in the app or mail. |
| `MAIL_LOGIN_URL` | Existing mail app base, including deployment prefix; used by default. A terminal `/login` is stripped. |
| `EMAIL_LOGIN_APP_URL` | Optional explicit app-base override. Invalid overrides fail instead of falling back. |
| `EMAIL_LOGIN_ENABLED` | Optional work-order mailer opt-in. Internal issuance, inspection and exchange do not require it. |

No separate email issuer, audience, key ID, RSA key pair or legacy cutoff is needed. Existing legacy external-login cutoff behavior remains independent. Rotating `AUTH_SECRET` invalidates email credentials as well as existing project sessions that use it. Regenerate previously issued RSA email links after this signing change. Old optional database `keyId` fields need no backfill.

URLs must use HTTPS, without credentials, query or fragment. Outside production, loopback HTTP is allowed for localhost, 127.0.0.1 and IPv6 loopback. Preserve the deployed app prefix, such as `/cmms-staging`.

For local testing, configure the API with `NODE_ENV=development` and `EMAIL_LOGIN_APP_URL=http://localhost:4200`. Run `npm run start:local` in CMMS_APP so it calls `http://localhost:3010`. Ordinary development and production profiles retain their own configuration. A local token must be validated against the API/database that issued it; a remotely deployed app can use a different secret or database. Restart services after changing configuration. Never commit real secrets.

## Generate a mail link in Postman

```http
POST http://localhost:3010/api/internal/email-login-tokens
Content-Type: application/json
x-internal-service-key: {{serviceKey}}
```

```json
{
  "userId": "6993082af0c0a565b983aa67",
  "accountId": "6993082af0c0a565b983aa65",
  "redirect": "/assets/analysis-details/69aa7e0d6adf6d49b021f172"
}
```

Use real IDs from the same environment. The recipient must be active in an active, visible account. Issuance requires only userId, accountId and redirect; actorId/reason are not used or stored. Trusted callers remain responsible for staff authorization. Use a clean cookie jar for service calls; requests carrying authentication cookies require the normal CSRF header.

HTTP 200 returns `status: true` and data containing `external_token`, `url`, `credentialId`, `expiresAt` and `redirectPath`. Use `data.url` exactly as the email button href, with normal HTML attribute escaping. For example: `http://localhost:4200/email-login#token=<credential>` or `https://app.example/cmms-staging/email-login#token=<credential>`.

Do not include JSON quotation marks in the URL: trailing `%22` is an extra quote and invalidates the token. Changing redirect requires sending a new issuance request and using its new data.url. Older tokens keep their original saved destinations.

## Validate and log in

```http
POST http://localhost:3010/api/users/email-login/inspect
Content-Type: application/json
```

```json
{ "token": "{{mailToken}}" }
```

Inspection returns recipient identity, expiry and the saved redirect. To establish a session, send the same JSON to `POST /api/users/email-login/exchange`. Neither endpoint requires a service key. Cookie authentication retains the response cookies and hydrates `GET /api/users/me`; bearer authentication uses data.token. Postman returns the destination; the Angular page performs browser navigation.

The app removes the credential fragment from history before inspection, confirms switching from another user/account, initializes authentication, then opens the saved route. Normal account, asset and page permissions still apply. Query/fragment data in a destination is preserved. External redirects, malformed encoding, control characters and authentication-loop/outlet destinations are rejected.

For browser compatibility, `GET /api/users/email-login#token=<credential>` redirects to the configured app page. The browser carries the fragment; the server never receives it and this GET does not authenticate. Support-token issuance remains POST-only; GET returns 405 with Allow: POST.

## Errors and revocation

Issuance returns 401 for an invalid service key, 400 for invalid IDs/destination, 410 for unavailable identity, 503 for unavailable signing/app URL configuration, and 500 for database failures. Configuration errors identify missing settings without exposing secret values. Expired, tampered, missing or revoked email credentials fail inspection/exchange with 410. Responses are no-store.

Existing authenticated management endpoints remain available: GET `/api/users/email-login/credentials`, POST `/api/users/email-login/revoke` with credentialId, and POST `/api/users/email-login/revoke-user` with userId. Revocation retains authenticated-user bookkeeping. Never log credentials, complete button URLs or sensitive email content.

Acceptance checks: issue a link; open it signed out; verify exact user/account and asset; repeat while signed into another account and test confirmation/cancellation; reopen before expiry; revoke and confirm rejection; verify unauthorized assets stay denied. A changed asset route must reload its data, and saved sidebar filters must not replace an explicit destination with the first visible asset.
