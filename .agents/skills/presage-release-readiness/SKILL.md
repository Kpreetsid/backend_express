---
name: presage-release-readiness
description: "Use when coordinating releases, branch merges, production rollout, rollback or CI validation across customer CMMS and internal admin applications."
---

# Prepare a release decision, not an implicit deployment

See [skill ownership](../../../docs/ai-suite/SKILL-ROUTING.md). From CMMS-Production load the root copy once; local duplicates support standalone checkouts.

Bare reference filenames such as [AUTH-AND-ACCESS.md](../../../docs/ai-suite/AUTH-AND-ACCESS.md) resolve inside this root's `docs/ai-suite/`. Resolve project-relative paths from the root containing this `.agents` directory, even when the chat starts elsewhere. Read [local workspace mapping](../../../docs/ai-suite/CURRENT-WORKSPACE.md), [suite index](../../../docs/ai-suite/INDEX.md), and that root's [AGENTS.md](../../../AGENTS.md) first. For an affected sibling, read its own guidance explicitly; parent discovery does not load child skill catalogs. Preserve existing specialized `docs/ai/` and engineering workflows. Apply implementation/test steps only to behavior changes; read-only reviews stay read-only, and instruction-only changes use metadata/link/path/whitespace checks without starting apps.

1. Record repo, branch, commit and changed files. Confirm approvals.
2. Identify API compatibility, DB/index/migration changes, secret and environment needs.
3. Determine backend-first or compatibility-bridge sequencing; plan stale frontend and SW clients.
4. Run available test commands and controlled environment smoke tests; record evidence.
5. Name rollback artifacts, cache implications, token compatibility, migrations and cleanup.
6. Produce go/no-go and unresolved risks. Never push, deploy or use live data without approval.

Read [RELEASE-AND-ROLLBACK.md](../../../docs/ai-suite/RELEASE-AND-ROLLBACK.md), [TESTING-AND-VALIDATION.md](../../../docs/ai-suite/TESTING-AND-VALIDATION.md).
