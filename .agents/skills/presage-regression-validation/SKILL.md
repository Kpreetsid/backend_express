---
name: presage-regression-validation
description: "Use when testing, debugging or reviewing changes that could break a frontend/backend pair, especially when branch-specific npm scripts, negative permission tests and runtime evidence are required."
---

# Validate with evidence, not expectation

See [skill ownership](../../../docs/ai-suite/SKILL-ROUTING.md). From CMMS-Production load the root copy once; local duplicates support standalone checkouts.

Bare reference filenames such as [AUTH-AND-ACCESS.md](../../../docs/ai-suite/AUTH-AND-ACCESS.md) resolve inside this root's `docs/ai-suite/`. Resolve project-relative paths from the root containing this `.agents` directory, even when the chat starts elsewhere. Read [local workspace mapping](../../../docs/ai-suite/CURRENT-WORKSPACE.md), [suite index](../../../docs/ai-suite/INDEX.md), and that root's [AGENTS.md](../../../AGENTS.md) first. For an affected sibling, read its own guidance explicitly; parent discovery does not load child skill catalogs. Preserve existing specialized `docs/ai/` and engineering workflows. Apply implementation/test steps only to behavior changes; read-only reviews stay read-only, and instruction-only changes use metadata/link/path/whitespace checks without starting apps.

1. Confirm branch and `package.json` of each changed repository.
2. Run targeted test closest to code first; add denial/error/tenant and concurrency tests as appropriate.
3. Run supported typecheck/build/test suite; do not invent `npm test` or `npm run lint` when absent.
4. For browser behavior test login, route reload, 401/403 handling, file Blob and relevant SSR/PWA state.
5. If integration infrastructure or DB is unavailable, say so; do not claim API/production tests passed.
6. Record command, exit status, assertion counts, passed/failed/skipped and proof of each acceptance criterion.

Read [TESTING-AND-VALIDATION.md](../../../docs/ai-suite/TESTING-AND-VALIDATION.md), [ERROR-CONTRACT.md](../../../docs/ai-suite/ERROR-CONTRACT.md).

**Example:** CMMS backend `priority/bugs` has `npm run test:cmms` but no generic `npm test`; invoking npm test is not evidence of suite health.
