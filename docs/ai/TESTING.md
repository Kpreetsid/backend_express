# Local checks and test execution

Inspect package.json, branch/HEAD and affected test imports before execution. A local lockfile/node_modules exist; package-lock.json is ignored/untracked, so version control alone does not establish reproducible clean installs. Do not reinstall packages for instruction-only validation.

Check tool availability before invoking package scripts: typecheck/build use npx, which can fetch absent executables. The current build's shx is undeclared and absent locally; ts-node is present through ts-node-dev rather than a direct declaration. Do not treat a clean-checkout build/test as verified or allow an incidental registry download as a static documentation check. No Node runtime is pinned in package.json or a version file; inspect supported dependency engines rather than deriving a runtime from @types/node.

## Configured commands

| Command | Behavior / scope |
| --- | --- |
| npm run typecheck | No-emit static TypeScript check with an installed compiler; no server startup |
| npm run build | Removes/recreates dist, compiles and copies public assets; requires resolving current shx/npx prerequisite |
| npm run test:password-security | Challenge/mail, recovery, password/session/expiry tests listed in package.json |
| npm run test:asset-train | Catalog plus asset train/component tests |
| npm run test:catalog | Catalog tests |
| npm run test:cmms-report | Report tests loaded through a Node -e command; inspect execution style |
| npm run test:user-notifications | Transaction notification tests |
| npm run catalog:check | Generated catalog consistency without regeneration |
| npm run catalog:generate | Rewrites generated artifacts; only for intended catalog changes |

No general npm test or lint script exists. Many tests use node:test/assert through ts-node/register/transpile-only; that execution is not typechecking. Not every .test.ts is in a package script. Discover adjacent tests instead of assuming named suites cover the whole repository or two-step authentication.

## Focused Windows example

From CMMS_API in PowerShell, after checking the test's imports/mocks:

~~~powershell
node --require ts-node/register/transpile-only --test src/modules/auth/email-login/email-login.routes.test.ts
npm run typecheck
git diff --check
~~~

Use affected paths; this example is not a passing-test claim. Prefer targeted tests while iterating, then broaden for affected consumers or unresolved failures.

## Runtime boundaries

npm start builds then executes dist/server.js. npm run dev starts the server and exposes an inspector on 0.0.0.0:9229. Startup can connect MongoDB/Redis, register change streams/sockets/jobs and run a log consumer. Neither is static verification.

Inspect import-time initialization before testing. Isolate DB/Redis/network/storage, mock mail and freeze time as appropriate. Do not load production secrets or send real messages. Do not blanket-run every test before understanding dependencies.

For endpoint changes cover success, malformed input, missing auth, wrong role/account, missing object, DB failure, replay/stale-version and partial side effects where relevant. Add a regression for a bug's trigger. For two-step use createTwoStepService's dependency seams and assert pending versus authenticated state.

For instruction-only edits validate YAML/frontmatter, local links/source paths, reference consistency, Git visibility and whitespace; no build/server/runtime test is required. Report PASS/FAIL/NOT RUN with actual evidence and distinguish static validation from application behavior.

## Email two-step test coverage

There is no package script named test:two-step. Run the isolated regressions directly:

~~~powershell
node --require ts-node/register/transpile-only --test src/user/two-step/two-step.integration.test.ts src/modules/auth/services/external-two-step.test.ts src/modules/company/services/two-step-settings.test.ts
~~~

These tests mock mail, clock, the challenge store and account/user/session operations. They cover challenge consumption/replay, credential and policy binding, cooldown/guess budgets, failed delivery, template/TLS behavior, external-session TFA denial before side effects, and settings role/tenant/revision handling. They do not establish live MongoDB/SMTP delivery or deployed browser behavior. Email-login URL fixtures use staging's current MAIL_LOGIN_URL contract.

## Profile update contracts

Run `node --require ts-node/register/transpile-only --test src/modules/users/controllers/profile.routes.test.ts` from this repository, followed by `npm run typecheck`. The route tests use actual domain routers, sanitization and cache mutation wrapping with injected authenticated principals and isolated model/Redis operations. They cover self/tenant binding, account-admin denial, literal route ordering, unknown fields/operators/prototype keys, text and phone boundaries, safe projections, server-only timestamps, duplicate account names and persistence failures. They do not verify live MongoDB indexes, Redis freshness, JWT/cookie/CSRF or a deployed frontend. The new UI requires the corresponding profile PATCH endpoints to deploy first or together.
