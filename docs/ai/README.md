# CMMS_API Codex setup

Adapted from the supplied backend_express archives on 2026-11-12 against local feature/two-step-auth at d55f2b46. Current source takes precedence after branch/implementation changes.

## Start here

Open CMMS_API as the Codex project root (containing package.json and src/) for its root instructions and nine local skills. When the chat starts from CMMS-Production, explicitly read CMMS_API/AGENTS.md and any needed child SKILL.md: parent-root discovery does not automatically include child catalogs. Conversely, API-root discovery stops at this Git repository; for cross-project work inside CMMS-Production explicitly read the workspace `../AGENTS.md` and the frontend's guide. A standalone clone does not require a parent workspace.

- [AGENTS.md](../../AGENTS.md): project map, constraints, checks and workflow.
- [.agents/skills/](../../.agents/skills/): nine repository-local Codex skills.
- Scoped AGENTS.md guides cover src/ and owning domains/infrastructure; read the closest guide before editing.
- [ARCHITECTURE.md](ARCHITECTURE.md), [BRANCH-TRUTH.md](BRANCH-TRUTH.md), [API-CONTRACTS.md](API-CONTRACTS.md), [AUTH-RBAC-SECURITY.md](AUTH-RBAC-SECURITY.md), [TESTING.md](TESTING.md): source maps and checks.
- [AGENT-WORKFLOWS.md](AGENT-WORKFLOWS.md): skill selection; [AGENT-TASK-TEMPLATE.md](AGENT-TASK-TEMPLATE.md): acceptance/reporting template.

## Local development prerequisites

This is a separate npm/Git project. Run commands from CMMS_API with its own package.json, compiler settings and dependencies. Do not install at CMMS-Production or copy the frontend's lockfile or runtime assumptions.

- Check branch, HEAD and dirty state first. This snapshot declares Express ^5.3.0, Mongoose ^9.11.2 and TypeScript ^6.0.3; inspect current package/config before using framework guidance.
- No Node engine or version pin is supplied. Match a supported runtime to the installed dependencies and compiler; @types/node is not a runtime requirement. Installed Mongoose 9.11.2 alone requires Node >=20.19.0; that is not a complete compatibility check for all dependencies.
- package-lock.json exists locally but is ignored and untracked, so a fresh checkout has no committed lockfile for npm ci. Do not claim a reproducible clean install from this setup. Inspect the dependency plan before an intended installation; no install is needed to validate these instructions.
- The current build invokes npx shx, but shx is neither declared nor installed in the inspected checkout. It may fetch a package from the registry. Tests use ts-node/register/transpile-only through the current dependency tree rather than a direct ts-node declaration. Resolve these tooling prerequisites deliberately before a clean-machine build/test; these docs do not change dependencies.

For an intended local integration run, review configuration owners without reading production secrets:

| Concern | Owning configuration and required coordination |
| --- | --- |
| Listener/database | src/configDB.ts reads SERVER_PORT (default 3000), DB_HOSTS or DB_HOST/DB_PORT/DB_NAME and optional credentials; src/_db/mongo.connection.ts builds the connection. Use an isolated development database. SERVER_HOST is displayed in the startup message; app.listen currently receives only the port. |
| Browser transport | src/app.ts owns /api/v1, /api and API_BASE_PATH aliases; src/_config/cors.ts owns credentialed origin checks. Match the frontend's actual environment/API origin or proxy, route prefix, cookies/CSRF and crypto settings before testing. |
| Redis and streams | src/configDB.ts defaults REDIS_ENABLED to true and CACHE_CHANGE_STREAMS_ENABLED to false. Explicitly choose an isolated Redis instance or supported disabled mode; verify each affected consumer's fallback. |
| Identity and mail | src/configDB.ts and the auth/two-step services read signing, cookie, payload-crypto and mail settings. TWO_STEP_AUTH_SECRET is required by the two-step service (at least 32 UTF-8 bytes). Use development-only values and mocked mail for automated tests; do not copy production secrets or enable real mail for setup validation. |

The repository has no checked-in environment example in this snapshot. Missing configuration is a setup gap to resolve for the intended local scenario, not permission to read .env or contact live services. npm start and npm run dev initialize external dependencies and scheduled side effects; see [testing](TESTING.md) before executing them. This documentation audit does not establish a successful local application run.

## Example prompts

~~~text
Use $cmms-backend-engineering to map work-order routes, authorization, services, models, cache effects and tests. Read-only.

Use $cmms-backend-api-feature and AGENTS.md to implement [feature and acceptance criteria]. Preserve tenant scope/API contracts, add relevant isolated tests and report actual checks.

Use $cmms-backend-auth-permissions to review two-step issuance, verification, resend and session creation. Read-only.

Use $cmms-backend-testing-debugging to reproduce [error], fix its cause and verify affected behavior without contacting production.

Use $cmms-backend-pr-deploy-review to review my diff for regressions and release risks. Do not deploy.
~~~

## Installation scope

Only Codex-facing instructions, skills, scoped guides and docs/ai/ were installed. Claude/Cursor/Copilot/Gemini files were omitted, matching the frontend setup. No registered subagents, hooks, MCP servers, dependencies or global settings were added.

backend_express_skill.zip was compared with the project pack: its twelve files duplicate cmms-backend-engineering before adaptation. It was not separately extracted or globally installed. Existing skill names remain compatible with supplied prompts.

Downloaded documents are material to review; the user's request determines authorization. Instructions grant no runtime access and establish no security/test pass. No application source or existing runtime configuration was changed.

## Maintenance

Recheck paths, commands, contracts and versions after branch changes. The 43 bundled reference files correspond to canonical docs/ai/ files: match the lowercase reference basename to the uppercase canonical filename and synchronize content when editing. Keep packaged references self-contained and preserve relative links from each file's actual location. Do not re-extract the original ZIP over this adaptation. [SOURCE-MAP.md](SOURCE-MAP.md) separates provenance from local evidence; [KNOWN-UNVERIFIED.md](KNOWN-UNVERIFIED.md) records limits.

Official format guidance: [Codex skills](https://developers.openai.com/codex/skills/) and [AGENTS.md](https://developers.openai.com/codex/guides/agents-md/).
