---
name: presage-email-login
description: "Use when building or debugging CMMS reusable email-login links, hash-fragment deep links, token expiry or revocation, or privileged internal support access to customer accounts."
---

# Keep email login and support login separate

See [skill ownership](../../../docs/ai-suite/SKILL-ROUTING.md). From CMMS-Production load the root copy once; local duplicates support standalone checkouts.

Bare reference filenames such as [AUTH-AND-ACCESS.md](../../../docs/ai-suite/AUTH-AND-ACCESS.md) resolve inside this root's `docs/ai-suite/`. Resolve project-relative paths from the root containing this `.agents` directory, even when the chat starts elsewhere. Read [local workspace mapping](../../../docs/ai-suite/CURRENT-WORKSPACE.md), [suite index](../../../docs/ai-suite/INDEX.md), and that root's [AGENTS.md](../../../AGENTS.md) first. For an affected sibling, read its own guidance explicitly; parent discovery does not load child skill catalogs. Preserve existing specialized `docs/ai/` and engineering workflows. Apply implementation/test steps only to behavior changes; read-only reviews stay read-only, and instruction-only changes use metadata/link/path/whitespace checks without starting apps.

1. Choose flow: reusable customer email credential **or** internal staff support grant.
2. Follow exact route/consumer chain in [EMAIL-AND-SUPPORT-LOGIN.md](../../../docs/ai-suite/EMAIL-AND-SUPPORT-LOGIN.md).
3. Classify token purpose, issuer, account, user/actor, TTL, revocation, allowed redirect and state challenge.
4. For email-login, keep fragment token memory-only, clean URL before network requests, inspect identity and confirm account switch.
5. For support-login, require staff authorization, company/env and trusted service-to-service issuance.
6. Test invalid/expired/replayed/revoked tokens, wrong principal and open redirect. Never log raw tokens.

**Observed configuration:** CMMS backend `priority/bugs` has email-link TTL 604800 seconds; verify intended product policy before changing.
