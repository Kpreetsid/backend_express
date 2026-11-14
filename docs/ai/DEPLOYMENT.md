# Build and deployment boundaries

package.json build removes/recreates dist, compiles and copies assets. It currently invokes undeclared shx through npx; shx was absent locally, so registry access may be required unless tooling is deliberately resolved first. start builds and runs the server; dev starts with a network-bound debugger. Do not run either as a documentation check.

src/server.ts initializes MongoDB, Redis, change streams, sockets, scheduled work and the log consumer. Readiness/startup/shutdown need runtime evidence, not compilation alone.

.github/workflows/main.yml, appspec.yml and scripts/ own deployment. appspec.yml targets Linux; scripts/start_app.sh runs npm start through PM2. Check actual triggers, paths, config injection and logs before making deployment claims.

For an authorized deployment change, check runtime/compiler compatibility, test evidence, artifacts, protected config, DB/cache topology, health/readiness, duplicate jobs, monitoring and rollback. Schema/index changes need compatibility and rollback planning.

Do not trigger deployment, change cloud resources, restart PM2, run cleanup scripts, migrate live records, rotate secrets or push/merge as a side effect of local coding/setup. Those actions must be within explicit user scope. Keep .env, logs and customer uploads out of artifacts and guidance.
