---
name: presage-auth-boundaries
description: "Use when tasks involve JWT, cookies, account feature grants, internal staff roles, environment switching, service credentials, permissions, cross-tenant access, stale sessions or private files."
---

# Enforce security at the owning backend

See [skill ownership](../../../docs/ai-suite/SKILL-ROUTING.md). From CMMS-Production load the root copy once; local duplicates support standalone checkouts.

Bare reference filenames such as [AUTH-AND-ACCESS.md](../../../docs/ai-suite/AUTH-AND-ACCESS.md) resolve inside this root's `docs/ai-suite/`. Resolve project-relative paths from the root containing this `.agents` directory, even when the chat starts elsewhere. Read [local workspace mapping](../../../docs/ai-suite/CURRENT-WORKSPACE.md), [suite index](../../../docs/ai-suite/INDEX.md), and that root's [AGENTS.md](../../../AGENTS.md) first. For an affected sibling, read its own guidance explicitly; parent discovery does not load child skill catalogs. Preserve existing specialized `docs/ai/` and engineering workflows. Apply implementation/test steps only to behavior changes; read-only reviews stay read-only, and instruction-only changes use metadata/link/path/whitespace checks without starting apps.

1. Classify principal: customer user, internal staff user, or trusted service.
2. Verify identity and token purpose; session, email-login and support-login tokens are different.
3. For CMMS APIs enforce `account_id`, resource ownership and role/feature action; for internal CMMS routes enforce staff action, company assignment and allowed environment.
4. Deny missing role/menu/permission and unauthorized `x-db-type` rather than trusting browser controls.
5. Keep bearer credentials away from untrusted URLs and logs; protect files at retrieval.
6. Test negative cases before claiming correctness.

Read [AUTH-AND-ACCESS.md](../../../docs/ai-suite/AUTH-AND-ACCESS.md), [SECURITY-AND-TENANCY.md](../../../docs/ai-suite/SECURITY-AND-TENANCY.md), [EMAIL-AND-SUPPORT-LOGIN.md](../../../docs/ai-suite/EMAIL-AND-SUPPORT-LOGIN.md).

**Example:** a hidden customer asset delete button is not a permission: a direct HTTP DELETE by a forbidden user must still fail without side effects.
