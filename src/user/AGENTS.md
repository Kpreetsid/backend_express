# Scoped identity and authentication instructions

Follow root/src guides and docs/ai/AUTH-RBAC-SECURITY.md. Trace current routes, session/cookie helpers, permission context and tests. Email/support login are present and use distinct credentials; see docs/ai/EMAIL-LOGIN-TOKENS.md.

For two-step, read two-step/AGENTS.md and trace initial login -> pending challenge -> verify/resend -> final session. Verify signature/purpose/expiry/revocation and account/user ownership. Preserve rate limits, CSRF/cookie policy, response modes and no-store headers. Do not log secrets/OTPs/token URLs, send real mail in tests or infer backend enforcement from frontend gating.
