# Scoped two-step authentication instructions

Read root, src and user guides plus docs/ai/AUTH-RBAC-SECURITY.md. Keep challenge issuance separate from final session creation. Trace authentication.service/controller and authentication.routes.ts together with this directory.

createTwoStepService exposes injected store/time/secret/code/loaders/sender for tests. Preserve versioned compare-and-set, digest binding, account policy revision, credential invalidation, delivery states, consumption, resend rotation and send/attempt budgets. Mongo TTL cleanup does not determine validity. Never initialize a session before consumption/eligibility checks or store raw codes in persistence/logs.

Test expiry, malformed challenge/code, cooldown, failed delivery, identity/policy changes, concurrent verification and replay with isolated dependencies. Preserve response modes and refresh/cookie handling in the completion controller. Do not send real mail for tests.
