# Authentication and Authorization

Existing bearer tokens, refresh transports, `accountID`, status codes, and response fields remain compatible.

## Target flow

1. Validate the access token algorithm, issuer, audience, signature, expiry, and revocation state.
2. Resolve the authenticated tenant from the existing account context.
3. Enforce tenant and permission policy at the service/repository boundary.
4. Record security-relevant allow/deny events without recording token contents.
5. Rotate refresh tokens and reject replay.

The web client may opt into Secure, HttpOnly, SameSite refresh cookies behind a feature flag. Cookie-authenticated mutations must validate CSRF. Existing external clients continue to use their current transport during the migration.

Frontend validation improves UX but never grants access. Backend authorization is authoritative. Secondary processor, logger, or ML origins must not receive primary CMMS cookies, bearer tokens, or `accountID` unless explicitly classified.

External-login consumers continue posting the opaque signed token to the
existing callback route. Only the processor-side token-minting route requires
`X-CMMS-Processor-Token`, compared in constant time against the centralized
`PROCESSOR_API_TOKEN`. The route fails closed when that secret is unavailable.
