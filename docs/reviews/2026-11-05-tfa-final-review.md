# Final TFA feature review

Date: 2026-11-05 (Asia/Calcutta)

## Verdict

**The CMMS_APP flag restriction is satisfied in the current source, but the overall authentication change is not ready for an unconditional sign-off.** One high-priority authentication exposure and several compatibility/coverage gaps remain.

This was a read-only feature review using the Superpowers code-review workflow, independent backend/frontend reviews, source tracing, and isolated mock diagnostics. No implementation, account flag, database record, authentication credential, or deployed configuration was changed. Only this report was added. No real login credentials were minted and no emails were sent.

Reviewed snapshots, both on `feature/two-step-auth`:

| Repository | Commit |
| --- | --- |
| CMMS_API | `20feab0abf997d21f4f0949c308855395559fdd2` |
| CMMS_APP | `fff656c91bc528fb6de744eed84c08b77253e632` |

The repositories were clean at review start. This report describes these current commits, rather than assuming the earlier working-tree implementation or its test counts is still present.

## Confirmed: CMMS_APP cannot change the TFA flag

**No reachable CMMS_APP flag mutation was found, including for account admins.**

- The account-security toggle, dialog and service have been removed from CMMS_APP. No production frontend code writes `two_step_auth_enabled` or calls a dedicated policy-setting endpoint.
- [Registered company routes](D:/CMMS-Production/CMMS_API/src/masters/company/company.routes.ts:16) do not register GET/PATCH `/two-step-auth`.
- Company creation and [company PUT](D:/CMMS-Production/CMMS_API/src/masters/company/company.controller.ts:95) construct explicit allowlisted payloads. The policy flag and revision are not forwarded.
- [Company image PATCH](D:/CMMS-Production/CMMS_API/src/masters/company/company.controller.ts:128) forwards only `fileName` and `updatedBy`.
- Registration and `companyService.createCompany` also omit caller-supplied TFA policy fields.
- Mocked calls tested admin and employee requests containing `two_step_auth_enabled: false`, a forged revision, and `$set`. None reached the persistence payload through PUT or image PATCH. No database/cache write was performed.
- Browser storage and request-body flags do not decide login policy. The password handlers load the user's account from MongoDB before deciding whether to issue a challenge.

There is an **unused server-side writer** in [two-step-settings.controller.ts](D:/CMMS-Production/CMMS_API/src/masters/company/two-step-settings.controller.ts:23). It is neither imported nor registered by current source routes. It is not a reachable flag-change vulnerability. Removing this obsolete controller would make the intended ownership clearer.

This conclusion concerns the current CMMS_APP and CMMS_API source. It does not prohibit authorized database operators or separate Internal applications from changing an account, and does not attest to a different deployed build.

## Findings

### F1 — P1: Public legacy token issuance permits passwordless access to TFA-disabled accounts

**Locations:** [authentication.routes.ts:15](D:/CMMS-Production/CMMS_API/src/user/authentication/authentication.routes.ts:15), [authentication.service.ts:233](D:/CMMS-Production/CMMS_API/src/user/authentication/authentication.service.ts:233), [authentication.service.ts:319](D:/CMMS-Production/CMMS_API/src/user/authentication/authentication.service.ts:319).

`GET /api/users/create_external_token/:email` is registered publicly with rate limiting but no caller authentication or authorized Internal-service check. The handler finds the active user by the supplied email, creates an external credential, and returns it. That credential can then enter the existing `/users/external_auth` exchange and session-creation flow when legacy exchange is allowed.

**Impact:** For an account with TFA disabled, knowing a user's email can be sufficient to obtain their login session without password or mailbox access. New accounts default to TFA disabled. The enabled-account guard protects accounts whose flag is true; this finding does not establish a bypass of that guard or a flag-write path.

**Evidence:** A mock-only Express request without authentication reached the public issuance handler and returned HTTP 200. The real issuer-to-exchange/session chain was traced in source; no real credential or victim session was created. The local environment has no legacy cutoff configured, so the default legacy exchange path is currently permitted there. Deployments with a cutoff that rejects fresh legacy credentials have a different exploit condition, but the public issuer remains registered.

**Recommendation:** Remove the public issuance route or require the established authorized Internal-service boundary. Add a regression asserting that an unauthenticated public request never reaches issuance or persistence. Preserve legitimately authorized email/support link workflows separately.

### F2 — P2: Versioned TFA endpoints fail when an existing authentication cookie is present

**Locations:** [csrf.middleware.ts:8](D:/CMMS-Production/CMMS_API/src/middlewares/csrf.middleware.ts:8), [csrf.middleware.ts:28](D:/CMMS-Production/CMMS_API/src/middlewares/csrf.middleware.ts:28), [app.ts:100](D:/CMMS-Production/CMMS_API/src/app.ts:100).

The API mounts `/api`, `/api/v1`, and their configured base-path variants. CSRF exclusions match `/api/users/two-step/verify` and `/api/users/two-step/resend`, which do not match the versioned aliases.

**Trigger:** A client sends verification/resend through a versioned alias with an existing access/refresh cookie and no CSRF header. The request receives 403 before the public challenge controller runs.

**Evidence from isolated middleware checks:**

| Request with an existing auth cookie and no CSRF header | Result |
| --- | --- |
| `/api/users/two-step/verify` | Passed to the next handler |
| `/api/v1/users/two-step/verify` | 403 |
| `/cmms_express/api/v1/users/two-step/resend` | 403 |

The normal CMMS_APP `/api/users/...` path works. This is an alias/cookie compatibility defect, not an OTP bypass.

**Recommendation:** Match normalized mounted paths consistently and narrowly for public login/challenge operations. Add primary/versioned/base-path tests, retaining CSRF protection on authenticated mutations.

### F3 — P2: Successful TFA login skips an existing password-expiry advisory

**Locations:** [two-step-verification.component.ts:45](D:/CMMS-Production/CMMS_APP/src/app/login/two-step/two-step-verification.component.ts:45), [login.component.ts:96](D:/CMMS-Production/CMMS_APP/src/app/login/login.component.ts:96), [two-step.controller.ts:109](D:/CMMS-Production/CMMS_API/src/user/two-step/two-step.controller.ts:109).

The normal login success branch displays `passwordExpiryMessage` when `passwordExpired` is true. The TFA branch leaves that page before normal success handling, and the verification page navigates immediately after success without displaying the returned advisory. The API still supplies the notice, and UserService preserves it.

**Impact:** A TFA-enabled user with an old password does not receive the existing password-update warning after completing the code step. This is an advisory regression; the original application intentionally permits login and warns, rather than requiring an immediate password reset.

**Related P3 UX omission:** The same new success path does not call the existing [PWA installation prompt](D:/CMMS-Production/CMMS_APP/src/app/login/login.component.ts:100) after navigation.

**Recommendation:** Carry the existing post-login warning and installation behavior into successful TFA completion without changing credential-validation rules. Test an expired-password success response and an install-eligible browser.

### F4 — P2: Backend TFA regression coverage is not retained in the current repository

**Locations:** `CMMS_API/src/user/two-step/`, `CMMS_API/src/user/authentication/`, [package.json:6](D:/CMMS-Production/CMMS_API/package.json:6).

The current API tree contains no dedicated backend TFA test files, and package scripts do not include a TFA test command. Existing password-security tests remain, but do not cover this challenge lifecycle or the new flag-immutability requirement. Earlier test files/counts from this conversation cannot be treated as committed coverage of the current snapshot.

**Impact:** Expiry, replay, concurrent consumption, attempt budgets, mail failure, policy enforcement and public issuance restrictions lack a repeatable backend TFA regression gate. The temporary diagnostics used in this review are not a substitute for committed CI tests.

**Recommendation:** Retain dedicated unit/integration tests and a CI command. Include both enabled/disabled accounts, all login entry points, every API mount, and forbidden policy writes for admins and ordinary users.

### F5 — P2, inherited requirement gap: Legacy credential errors still allow account enumeration

**Location:** [authentication.service.ts:57](D:/CMMS-Production/CMMS_API/src/user/authentication/authentication.service.ts:57).

An unknown active username/email returns 404 `User data not found`; an existing user with an incorrect password returns 401 `Invalid credentials`. The different status/message and earlier return reveal whether an identifier exists.

This is retained legacy behavior, not a newly introduced TFA regression: the later instruction to preserve the original validation/error pattern was followed. It remains inconsistent with the initial request for non-enumerating authentication errors.

**Recommendation:** If that initial security objective is still required, normalize public credential errors and timing at an agreed boundary while preserving the internal validation order. Do not silently alter the legacy contract as part of an unrelated fix.

## Controls that passed review

| Control | Assessment |
| --- | --- |
| Flag source | Server-loaded account; browser values cannot override it |
| Disabled/missing flag | Original direct password-login path retained |
| Enabled password endpoints | Challenge returned before access/refresh sessions or auth cookies |
| Enabled external/support/email exchanges | Rejected by the shared enabled-account guard |
| Code generation | `crypto.randomInt`, four digits with leading zeros |
| Storage | HMAC-bound OTP digest and hashed opaque challenge; no plaintext code stored |
| Identity binding | User, tenant, password hash, email and policy revision checked |
| Expiry | Explicit five-minute validity check; independent of delayed TTL cleanup |
| Replay/concurrency | Atomic version/generation conditions and single consumption |
| Attempts | Five incorrect guesses and fifteen-minute issuance lockout |
| Sending | Sixty-second cooldown and five sends per rolling fifteen-minute principal window |
| Fresh login/resend | Does not reset the active guess/send budgets |
| Mail failure | Pending challenge invalidated; no session issued |
| Transport/logging | TLS certificate checks, sanitized SMTP failures, code/token redaction |
| Angular pending state | Memory only; no authenticated initialization before successful code verification |
| Reload/expired code | Returns to password entry; safe return destination |
| Interceptors | Verification/resend are excluded from token refresh and automatic retries |
| Original validation | Original password-handler check bodies retained apart from feature hooks |
| Session epoch | Successful TFA preserves the password-authentication start time |
| Template packaging | Existing build copy covers the new `dist/public` template path |

## Fresh validation performed

| Check | Result |
| --- | --- |
| Focused Angular suite: verification/DOM, UserService, login, email/external login, guards and interceptors | 81/81 passed; exit 0 |
| Angular application/template compilation (`ngc --noEmit`) | Passed; exit 0 |
| API TypeScript compilation | Passed; exit 0 |
| Existing API password-security suite | 36/36 passed; exit 0 |
| Independent mock challenge diagnostics | 10 passed: expiry, replay, lockout, cooldown, resend/token rotation, persisted budgets, concurrent consumers, SMTP failure, identity/policy changes |
| Independent mail diagnostics | Template, TLS/recipient rules and sanitized failures passed |
| Additional mock checks | Confirmed forbidden flag fields are dropped; no policy route registered; reproduced F1 reachability and F2 alias failure |

Diagnostic fixture note: the initial direct company-controller probe lacked Express's `res.once` method required by its cache wrapper. The fixture was corrected and all four admin/employee PUT/PATCH combinations passed. This was a test-harness correction, not an application finding.

## Deployment checks and limits

- This is a bounded TFA/authentication review, not a complete repository security audit.
- No live database concurrency/index test, SMTP delivery, production login, migration or deployment was performed. Mock tests establish code behavior, not production service availability.
- Local passive configuration checks confirmed a dedicated key of at least 32 bytes and configured SMTP fields. No secret values were printed. This does not establish configuration on other replicas or environments.
- The current challenge collection is `user_auth_code`; verify its indexes and TTL in the intended database. Schema declarations alone do not prove deployed indexes exist.
- All API replicas must share a stable dedicated `TWO_STEP_AUTH_SECRET`. Key rotation intentionally invalidates pending challenges.
- Authorized external/database changes to account policy should increment `two_step_auth_revision` when the flag changes, so an off/on cycle invalidates earlier pending challenges.
- Existing sessions are intentionally not revoked when the flag is enabled; the selected policy applies at new login. This matches the earlier agreed rollout behavior.
- IP limiter storage is process-local. Per-principal challenge budgets persist in MongoDB across replicas; use a shared gateway/store if a global per-IP ceiling is required.
- The broad Angular suite was not rerun in this review. The fresh result above is the focused current-snapshot suite, not an all-application pass claim.

## Suggested order before sign-off

1. Resolve F1 and retain a public-issuance regression test.
2. Resolve F2 and F3, then repeat focused login/verification checks.
3. Restore durable backend coverage (F4), including tests proving no CMMS_APP caller can change policy.
4. Decide explicitly how to reconcile legacy compatibility with non-enumerating errors (F5).
5. Complete the environment-specific database/index and SMTP smoke checks with a dedicated test tenant.

**No fixes were applied during this review.**
