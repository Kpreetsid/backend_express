---
name: presage-feature-audit
description: "Use when a user asks what modules or features are implemented, missing, duplicated or incomplete across four applications, or asks to compare functionality between frontend and backend."
---

# Audit a business capability end-to-end

See [skill ownership](../../../docs/ai-suite/SKILL-ROUTING.md). From CMMS-Production load the root copy once; local duplicates support standalone checkouts.

Bare reference filenames such as [AUTH-AND-ACCESS.md](../../../docs/ai-suite/AUTH-AND-ACCESS.md) resolve inside this root's `docs/ai-suite/`. Resolve project-relative paths from the root containing this `.agents` directory, even when the chat starts elsewhere. Read [local workspace mapping](../../../docs/ai-suite/CURRENT-WORKSPACE.md), [suite index](../../../docs/ai-suite/INDEX.md), and that root's [AGENTS.md](../../../AGENTS.md) first. For an affected sibling, read its own guidance explicitly; parent discovery does not load child skill catalogs. Preserve existing specialized `docs/ai/` and engineering workflows. Apply implementation/test steps only to behavior changes; read-only reviews stay read-only, and instruction-only changes use metadata/link/path/whitespace checks without starting apps.

1. Start with [FEATURE-MATRIX.md](../../../docs/ai-suite/FEATURE-MATRIX.md) and [END-TO-END-WORKFLOWS.md](../../../docs/ai-suite/END-TO-END-WORKFLOWS.md).
2. Confirm the active checkout and search for feature entry points, handlers, models, tests and routes.
3. Classify findings: observed code, route wired, authorized, tested, runtime checked, or unknown.
4. Compare user-facing UI actions against actual backend contracts and status/error behavior.
5. Identify duplicated ownership, stale paths, missing tests and privilege leakage; distinguish concerns from proven bugs.
6. Return a matrix per repository with evidence links and next verification step. Never mark feature complete from a folder name.

**Example:** notification UI plus backend route proves related code exists, not that push delivery works offline or after consent revocation.
