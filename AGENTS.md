# backend_express - Presage CMMS API

## Shared instructions and ownership

- Read `D:/presage/development/AGENTS.md` for shared rules and the three-project flow. This repository has its own Git root; explicitly load the parent guide.
- This Express/TypeScript service owns MongoDB CMMS business records: accounts, users/permissions, asset/location hierarchy, work management, inventory, observations and notifications.
- `../cmmsF` consumes these APIs. `../data_processors` owns monitoring persistence, ingestion and analytics. Preserve organization/asset identity and synchronization contracts across them.

## Where to look first

- Server and API mounts: `src/server.ts`, `src/app.ts`; authentication: `src/_config/auth.ts` and the relevant middleware.
- Business routes/controllers/services: the affected directory under `src/masters/`, `src/work/`, `src/transaction/`, `src/reports/`, or its actual route mount. Models: `src/models/`.
- Processor integration: `src/api-processor/index.ts`, `src/utils/externalAPI.ts`, `src/utils/processor-url.ts`; OPC proxy: `src/routes/opcua.routes.ts`.
- Analysis feature selections: `src/masters/analysisFeature/`. Trace the UI client when changing feature IDs or response shapes.
- Shared context index: `../presage_project_context/00_INDEX.md`; deeper backend notes: `../presage_project_context/backend_express/`.
- Current feature/function coverage: shared `03_COVERAGE_AUDIT.md` and backend `06_SOURCE_INVENTORY.json` / `06_SOURCE_INDEX.md`; search by symbol/path rather than loading the full catalogue.
- Asset-train catalog/components: `src/catalog/` and `src/masters/asset/`. Guide viewing and separate internal publishing: `src/knowledge-base/`. Check the audit's unresolved Django child-component deletion contract before assuming that cross-service operation exists. No SAP adapter was found in the audited current `src/` tree.

## Implementation and checks

- Follow adjacent route/controller/service/model patterns. Preserve authorization, tenant/asset scoping, validation, API versions, notification behavior, and processor synchronization/compensation.
- Do not assume a successful MongoDB write means processor synchronization succeeded. Trace both sides when changing equipment, endpoints or health flows.
- Use `package.json` for current commands. `npm run typecheck` performs TypeScript validation; run focused adjacent tests or existing suites such as `npm run test:asset-train` / `npm run test:catalog` only when relevant.
- Do not rebuild generated output, run the development server, contact production services, or change credentials as part of context maintenance.

## Context maintenance

- Follow `../.codex/CONTEXT_MAINTENANCE.md`. Run `node D:/presage/development/.codex/context-check.cjs status --project backend_express` at task start and completion. In a chat opened at the development root, follow the prompt hook's current session/turn selection command for backend_express and any other explicitly affected Presage project. Do not check unrelated repositories.
- Review changed routes, models, services, permissions, configuration names and commands. Update affected backend context; update the shared integration map for request/response, identity, authentication or synchronization changes.
- Acknowledge the reported review ID only after source review and any necessary context updates. Keep instructions stable; record no-context-impact outcomes for small internal changes.
