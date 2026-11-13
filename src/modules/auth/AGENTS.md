# Scoped authentication instructions

Follow root/src guides and docs/ai/AUTH-RBAC-SECURITY.md. Trace routes through controllers, services, current user/account models and session helpers. Preserve staging login validators and cookie, CSRF, token-purpose and tenant boundaries. Email-login and support-login are separate credentials; support issuance is POST-only. Two-step implementation and scoped guidance remain in src/user/two-step/. Mock database, sessions, time and mail in tests; never start src/server.ts for verification.
