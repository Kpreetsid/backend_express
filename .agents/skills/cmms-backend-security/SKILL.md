---
name: cmms-backend-security
description: "Use when a downloaded suite task specifically references cmms-backend-security for CMMS_API authentication and permissions; prefer cmms-backend-auth-permissions for direct project work."
---

# Suite compatibility entry point: cmms-backend-security

Use the existing [cmms-backend-auth-permissions](../cmms-backend-auth-permissions/SKILL.md) workflow for this task. This compatibility name does not introduce a second implementation procedure or override the owning project guidance. Read [AGENTS.md](../../../AGENTS.md), [local workspace mapping](../../../docs/ai-suite/CURRENT-WORKSPACE.md) and [skill routing](../../../docs/ai-suite/SKILL-ROUTING.md); resolve project paths against CMMS_API, not the chat's working directory.

For cross-application work, select one shared suite skill copy through the workspace router, then load only the relevant owning-project specialist. Use current source and package scripts rather than branch-specific pack layouts or security claims. Read-only review remains read-only; instruction-only changes need static checks; behavior changes need focused positive and negative tests. Authorized local sibling work follows the user's task scope after reading the sibling guide.
