# Skill ownership and root-folder routing

Start with the user's affected application, not a matching folder name or downloaded example. The workspace has four separate Git/package roots. Child skills may be absent from the root chat's catalog; read their actual SKILL.md files directly rather than installing global copies.

## Choose one coordinating workflow

- Two or more applications, except CMMS_APP + CMMS_API only (including INTERNAL_APP + INTERNAL_API): `$presage-cross-repo-change` from the root, or the local copy in a standalone checkout.
- CMMS_APP and CMMS_API only: root `$cmms-fullstack-development`.
- One repository: its existing engineering entry point, then only the specialist relevant to the task.

Root instructions route; project and scoped instructions govern implementation. The user's authorized cross-project task already includes necessary local sibling changes. Read-only tasks stay read-only and instruction-only work uses static checks. External operations remain separately authorized.

## Shared suite copies

Eight `presage-*` suite skills have intentional copies at the root and each child for standalone checkouts. From CMMS-Production select the root copy once. In a standalone repository use its local copy. These are the same skill names, not forty different workflows; do not load multiple copies. The validator checks byte-equivalent content after line-ending normalization, including UI metadata. Canonical shared suite documents likewise live at the root; child copies are synchronized for standalone use. CURRENT-WORKSPACE.md, PROJECT.md and INSTALL.md are local overlays.

## Imported compatibility names

The original project specialists take precedence over overlapping imported entry points. Imported names remain usable by downloaded prompts, but delegate to the established owner instead of repeating an implementation workflow.

| Imported name | Owning specialist | Repository |
| --- | --- | --- |
| `cmmsf-ui-development` | `cmmsf-angular-feature` | CMMS_APP |
| `cmms-backend-module` | `cmms-backend-api-feature` | CMMS_API |
| `cmms-backend-security` | `cmms-backend-auth-permissions` | CMMS_API |
| `internal-angular-feature` | `presage-internal-angular-feature` | INTERNAL_APP |
| `internal-admin-workflows` | `presage-internal-engineering` | INTERNAL_APP |
| `internal-express-module` | `presage-internal-api-feature` | INTERNAL_API |
| `internal-env-isolation` | `presage-internal-api-environments` | INTERNAL_API |

The existing `cmmsf-pwa-offline` skill was preserved; no second PWA workflow was installed. For auth and environment work inspect current enforcement before describing a desired invariant as an existing protection.

## Reference ownership

Use each project's canonical `docs/ai/` for local work. Packaged skill `references/` mirror those guides for portability; matching basenames must stay synchronized. Shared `docs/ai-suite/` maps are remote branch snapshots unless explicitly marked local. Preserve dated SHA/source provenance; do not replace historical inspection SHAs with current HEAD while retaining an old inspection claim. Check live branch/HEAD/status and package scripts at task start.

## Project entry points

| Repository | Engineering | Features | Access | Tests/debugging |
| --- | --- | --- | --- | --- |
| CMMS_APP | `cmmsf-engineering` | `cmmsf-angular-feature` | `cmmsf-access-control` | `cmmsf-testing-debugging` |
| CMMS_API | [cmms-backend-engineering](../../.agents/skills/cmms-backend-engineering/SKILL.md) | [cmms-backend-api-feature](../../.agents/skills/cmms-backend-api-feature/SKILL.md) | [cmms-backend-auth-permissions](../../.agents/skills/cmms-backend-auth-permissions/SKILL.md) | [cmms-backend-testing-debugging](../../.agents/skills/cmms-backend-testing-debugging/SKILL.md) |
| INTERNAL_APP | `presage-internal-engineering` | `presage-internal-angular-feature` | `presage-internal-access-control` | `presage-internal-test-debug` |
| INTERNAL_API | `presage-internal-api-engineering` | `presage-internal-api-feature` | `presage-internal-api-permissions` | `presage-internal-api-test-debug` |

Sibling paths above are optional in standalone checkouts. In this workspace locate them through the local map and read the actual sibling SKILL.md.
