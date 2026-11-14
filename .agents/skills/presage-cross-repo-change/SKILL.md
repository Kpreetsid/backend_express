---
name: presage-cross-repo-change
description: "Use when a task spans two or more of the CMMS and internal Presage applications, especially when feature ownership, integration order, branch differences or shared contracts are uncertain."
---

# Coordinate a cross-repository change

Bare reference filenames such as [AUTH-AND-ACCESS.md](../../../docs/ai-suite/AUTH-AND-ACCESS.md) resolve inside this root's `docs/ai-suite/`. Resolve project-relative paths from the root containing this `.agents` directory, even when the chat starts elsewhere. Read [local workspace mapping](../../../docs/ai-suite/CURRENT-WORKSPACE.md), [suite index](../../../docs/ai-suite/INDEX.md), and that root's [AGENTS.md](../../../AGENTS.md) first. For an affected sibling, read its own guidance explicitly; parent discovery does not load child skill catalogs. Preserve existing specialized `docs/ai/` and engineering workflows. Apply implementation/test steps only to behavior changes; read-only reviews stay read-only, and instruction-only changes use metadata/link/path/whitespace checks without starting apps.

See [skill ownership](../../../docs/ai-suite/SKILL-ROUTING.md) for canonical project specialists and synchronized standalone copies. Select this root copy once when working from CMMS-Production.

**Rule:** trace owners and contracts before touching multiple repositories.

1. Read [REPOSITORIES-AND-BRANCHES.md](../../../docs/ai-suite/REPOSITORIES-AND-BRANCHES.md), [FEATURE-MATRIX.md](../../../docs/ai-suite/FEATURE-MATRIX.md), [OWNERSHIP-AND-BOUNDARIES.md](../../../docs/ai-suite/OWNERSHIP-AND-BOUNDARIES.md) and [CHANGE-RUNBOOK.md](../../../docs/ai-suite/CHANGE-RUNBOOK.md).
2. For each involved repo, record active branch, clean/dirty state, framework version, actual route and data owner.
3. Write a compact contract matrix: caller, endpoint, identity, tenant/environment, data model, side effects, tests.
4. Select minimal changes; preserve compatibility. Do not backport renamed paths from another branch.
5. Implement one vertical slice at a time with regression and negative security tests.
6. Verify actual exit codes. Report untested work, blockers and rollback order.

**Red flags:** similar names with different ownership, silent backend copy, accidental staging-to-production, frontend-only authorization, production deploy without approval.

**Example:** a staff action to change a CMMS account feature belongs first to internal admin frontend/API, then customer CMMS permission implementation and customer UI refresh - not necessarily all four repo changes.
