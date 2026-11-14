---
name: presage-knowledge-base
description: "Use when implementing or diagnosing internal PDF guide authoring, publishing, permissions, file storage/mirroring or CMMS customer knowledge-base viewing and download."
---

# Preserve publisher/reader separation

See [skill ownership](../../../docs/ai-suite/SKILL-ROUTING.md). From CMMS-Production load the root copy once; local duplicates support standalone checkouts.

Bare reference filenames such as [AUTH-AND-ACCESS.md](../../../docs/ai-suite/AUTH-AND-ACCESS.md) resolve inside this root's `docs/ai-suite/`. Resolve project-relative paths from the root containing this `.agents` directory, even when the chat starts elsewhere. Read [local workspace mapping](../../../docs/ai-suite/CURRENT-WORKSPACE.md), [suite index](../../../docs/ai-suite/INDEX.md), and that root's [AGENTS.md](../../../AGENTS.md) first. For an affected sibling, read its own guidance explicitly; parent discovery does not load child skill catalogs. Preserve existing specialized `docs/ai/` and engineering workflows. Apply implementation/test steps only to behavior changes; read-only reviews stay read-only, and instruction-only changes use metadata/link/path/whitespace checks without starting apps.

1. Inspect internal publisher UI/API and customer reader UI/API independently.
2. Internal publisher requires current role-menu `view/add/edit/delete` and PDF/signature/path/revision validation.
3. Customer CMMS API exposes only published guide list and file read; do not add unsafe publisher operations there.
4. Confirm metadata connection and file mirror share correct environment paths; stage/rollback file changes safely.
5. Validate draft invisibility, permission deny, malformed PDF, 409 revision conflict, missing file and successful customer read.

Read [KNOWLEDGE-BASE.md](../../../docs/ai-suite/KNOWLEDGE-BASE.md), [FILES-AND-REPORTS.md](../../../docs/ai-suite/FILES-AND-REPORTS.md).
