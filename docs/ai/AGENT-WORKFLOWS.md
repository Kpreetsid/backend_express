# Codex workflow and skill routing

Default to one agent: discover the branch/task, trace the affected path, state acceptance cases, implement narrowly, verify and review the diff. Scale these steps to the request; instruction-only work uses static documentation checks. These files are instructions/skills, not registered Codex subagents.

| Task | Skill |
| --- | --- |
| Discovery or mixed engineering | $cmms-backend-engineering |
| Endpoint/domain implementation | $cmms-backend-api-feature |
| Login, two-step, roles, tenancy | $cmms-backend-auth-permissions |
| Email/support credentials | $cmms-backend-email-login |
| Schema/query/integrity/concurrency | $cmms-backend-mongoose-data |
| Upload/storage/file access | $cmms-backend-upload-security |
| Cron/scheduling/mail | $cmms-backend-scheduler-mail |
| Reproduction/tests/debugging | $cmms-backend-testing-debugging |
| Read-only diff/release review | $cmms-backend-pr-deploy-review |

Load only relevant guides. Use applicable Superpowers workflows when available; the plugin is not required on another developer's machine and grants no runtime access.

In a CMMS-Production-root chat, explicitly read this project's AGENTS.md and the selected SKILL.md if it is absent from the skill catalog. In an API-root chat, a cross-project task also needs an explicit read of the parent workspace guide (when present) and CMMS_APP's owning instructions. Do not duplicate child skills globally merely to make them discoverable. Necessary local UI/API changes are already authorized by a user request spanning both projects.

If delegation is requested/supported, give bounded paths, acceptance criteria, single edit ownership and check evidence. Read-only reviewers should not edit implementer files. Static review is not runtime validation. Follow the user's authorization for external writes and side effects.
