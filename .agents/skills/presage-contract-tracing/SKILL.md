---
name: presage-contract-tracing
description: "Use when API calls return 404 or wrong payloads across CMMS/internal projects, when URL prefixes change, or when frontend and backend method, error, token or response behavior may have drifted."
---

# Trace the complete HTTP contract

See [skill ownership](../../../docs/ai-suite/SKILL-ROUTING.md). From CMMS-Production load the root copy once; local duplicates support standalone checkouts.

Bare reference filenames such as [AUTH-AND-ACCESS.md](../../../docs/ai-suite/AUTH-AND-ACCESS.md) resolve inside this root's `docs/ai-suite/`. Resolve project-relative paths from the root containing this `.agents` directory, even when the chat starts elsewhere. Read [local workspace mapping](../../../docs/ai-suite/CURRENT-WORKSPACE.md), [suite index](../../../docs/ai-suite/INDEX.md), and that root's [AGENTS.md](../../../AGENTS.md) first. For an affected sibling, read its own guidance explicitly; parent discovery does not load child skill catalogs. Preserve existing specialized `docs/ai/` and engineering workflows. Apply implementation/test steps only to behavior changes; read-only reviews stay read-only, and instruction-only changes use metadata/link/path/whitespace checks without starting apps.

1. Inspect caller URL construction, base URL/proxy, method, credentials, headers and payload.
2. Inspect outer Express `app` mounts, nested route registrations and leaf handler. Compose full URL explicitly.
3. Read guards, validators, action/tenant checks, controller/service/model and serializer.
4. Capture response JSON or binary type, status/error semantics, retry/idempotency and file headers.
5. Compare caller expectations with producer; add tests on both sides if changing contract.
6. Prefer compatibility migrations over simultaneous breaking changes.

See [API-CONTRACT-MAP.md](../../../docs/ai-suite/API-CONTRACT-MAP.md), [CONTRACT-CHANGE-CHECKLIST.md](../../../docs/ai-suite/CONTRACT-CHANGE-CHECKLIST.md), [ERROR-CONTRACT.md](../../../docs/ai-suite/ERROR-CONTRACT.md).

**Example:** `/api/knowledge-base/guides` is customer read-only; `/api/internal/knowledge-base/guides` is internal publisher. Similar leaf paths do not imply identical authorization.
