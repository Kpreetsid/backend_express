# API routes and contract boundaries

src/app.ts mounts one API router at /api/v1, /api, and both prefixes under API_BASE_PATH (default /cmms_express). A proxy may strip or retain the outer prefix; do not invent deployed URLs.

The router contains crypto, internal account-permission events, internal support-login tokens, public user routes from src/nonAuthRoutes.ts, and authenticated /upload, /master, /opcua, /work, /reports, /map, /notifications and /knowledge-base groups. Public/internal labels do not establish authorization: inspect each handler.

Example: src/work/work.routes.ts composes order.routes.ts; its /orders mount yields GET /api/work/orders and aliases. Preserve static-route ordering before /:id. Do not infer a top-level /inspection endpoint from an inspection model.

## Validation and responses

- Body/query validators use express-validator plus src/middlewares/validator.middleware.ts. Its validation response is 422 with status, message, errors and a compatibility error field.
- src/middlewares/validate.ts exports validateParam and validateParamId; it is not the archive's Joi validateBody helper.
- Preserve endpoint envelopes, id/_id mapping, pagination and HTTP status. Work-order list responses include pagination; do not impose one uniform shape without checking consumers.
- Trace authenticated account/object ownership through service predicates; caller headers/IDs alone are not authorization.

## Retry and concurrency

src/work/order/order.routes.ts applies src/middlewares/idempotency.middleware.ts. With an Idempotency-Key, participating POST/PUT/PATCH requests bind the record to account/user/key and a request hash. Replay, in-progress conflicts and changed bodies have distinct behavior. This is not a global guarantee or proof of exactly-once effects.

src/utils/sync-concurrency.ts handles If-Match, ETag and stale-version errors (412). src/models/plugins/sync-version.plugin.ts maintains versions on covered writes. Preserve payloads and inspect atomic predicates before making concurrency claims.

Coordinate changed methods, paths, cookies, crypto/context headers and response keys with actual CMMS_APP consumers after reading that project's guide. The user's cross-project feature scope includes necessary local changes in both repositories; an API-only task does not implicitly include unrelated frontend work. Report any intentionally incompatible change and its coordinated rollout requirements.

## Account email-verification policy

GET and PATCH `/api/master/companies/two-step-auth` (plus the existing API aliases) expose the singleton account policy through the existing company router. This static route must precede `/:id`. Both handlers require the exact `admin` role and use the authenticated account, not a caller-selected ID. PATCH accepts only `{ enabled: boolean }`; responses expose `{ status: true, data: { enabled: boolean }, message? }` and use no-store. Preserve strict input, secret availability checks when enabling and transition-only policy revision/audit updates.

## Personal and account profile updates

`PATCH /api/master/users/profile` (and existing API aliases) accepts exactly `{ firstName, lastName, phone_no }`. All fields are required. The authenticated user and account IDs scope one atomic `$set` write to an active user; callers cannot select another record. Names are trimmed strings with first-name length 2–100 and last-name length 1–100. The success envelope is `{ status: true, message: "User profile updated successfully", data: { _id, account_id, firstName, lastName, phone_no, updatedAt } }`.

The structured `phone_no` contains exactly six required strings: `number`, `internationalNumber`, `nationalNumber`, `e164Number`, `countryCode`, `dialCode`. Values are trimmed, `countryCode` is uppercased, and accepted display formatting is preserved. E.164 is a `+`, a nonzero first digit and 7–15 digits total; `dialCode` is `+` plus 1–3 digits and must prefix E.164. `countryCode` has two ASCII letters. International digits must equal E.164; national digits must match its subscriber digits with an optional national trunk `0`; `number` may be either representation. Formatting accepts spaces, parentheses, dots and hyphens without extensions. Regional validity and geographic country/calling-code correspondence remain the frontend phone library's responsibility; this endpoint does structural validation without a new parsing dependency.

The new profile dialog sends canonical wire metadata after the existing phone library validates the regional number: `number = internationalNumber = e164Number`, `nationalNumber = e164Number.slice(dialCode.length)`, retaining `countryCode` and `dialCode`. For example, `{ number: "+12025550123", internationalNumber: "+12025550123", nationalNumber: "2025550123", e164Number: "+12025550123", countryCode: "US", dialCode: "+1" }` is stored and returned unchanged. This represents Russian, Hungarian and Argentine numbers without regional trunk-prefix inference on the server. The original formatted control value stays in the UI until success. Supported older formatted structured values remain accepted as described above; login and user-creation phone validation do not change.

`PATCH /api/master/companies/profile` accepts `{ account_name, description? }` for the exact authenticated `admin` role. The authenticated account ID scopes one atomic update to an existing visible, active account. Account name is a required trimmed string of length 2–150; description is an optional plain string of at most 2000 characters after trimming. Omission preserves the current description; an empty string clears it. The success envelope is `{ status: true, message: "Account profile updated successfully", data: { _id, account_name, description, updatedAt } }`; an absent stored description is returned as an empty string. Both routes return the server-generated `updatedAt` as an ISO timestamp for merging visible update metadata; callers cannot supply it.

Both literal routes precede `/:id`, run model validators and existing timestamps, set `Cache-Control: no-store`, and return allowlisted projections for merging into matching client state. Existing controller-cache mutation handling invalidates account-scoped `users/roles/mappings` tags for personal updates and `companies/settings/users` for account updates after successful responses; unavailable Redis retains its existing bypass behavior. No new conditional-write or idempotency contract is introduced.

Invalid/missing fields, arrays, operators, nested unknown phone fields and invalid values return 400; missing or malformed authenticated identity returns 401; denied account roles return 403; absent matching records return 404; duplicate account names return 409 with a useful message; persistence failures return a sanitized 500. The sanitizer records only a request-local boolean when body keys were removed or consumed (including own `__proto__`), allowing these strict routes to reject the original invalid payload without retaining it. Existing routes continue consuming their usual sanitized bodies. No login/TFA validators or broad administration contracts change. Deploy the API before or together with the profile-dialog UI; no schema change or migration is needed.
