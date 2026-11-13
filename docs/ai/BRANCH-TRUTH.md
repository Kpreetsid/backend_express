# Current checkout truth

> This feature-branch snapshot is historical. For the current staging module layout and integration checks, read [STAGING-LAYOUT.md](STAGING-LAYOUT.md).

Snapshot: CMMS_API, feature/two-step-auth, HEAD d55f2b46, inspected 2026-11-12. At session start check git branch --show-current, git rev-parse HEAD, git status --short and package.json. Source on the active checkout supersedes this snapshot.

- Declared ranges: Express ^5.3.0, TypeScript ^6.0.3, Mongoose ^9.11.2, express-validator ^7.3.2, ioredis ^6.0.0, Multer ^2.4.0. Do not substitute the supplied pack's Express-5.1/Mongoose-8/Joi patterns.
- package.json has type commonjs; tsconfig.json uses NodeNext module/resolution, ES2024 target, strict mode, noImplicitAny, noUnusedLocals and noEmitOnError. Match local extensionless imports and module boundaries.
- Local utilities are src/utils/; terminal errors are handled in src/middlewares/error-handler.ts. src/middlewares/validate.ts exports validateParam/validateParamId; body validators use express-validator with src/middlewares/validator.middleware.ts. There is no local Joi dependency.
- src/_cache/, src/routes/, src/user/email-login/, src/user/support-login/ and src/user/two-step/ exist. Inspect their callers rather than inferring behavior from another branch name.
- API aliases are /api/v1, /api and both under API_BASE_PATH (default /cmms_express). Route registration is authoritative; no local top-level inspection mount was observed in app.ts.
- Scripts include dev, build, start, typecheck, targeted test:* and catalog commands. No general test or lint script. A local package-lock.json and node_modules exist, but the lockfile is ignored/untracked. The build uses npx shx without a declared/installed shx; tests use transitive ts-node. Check tooling prerequisites before execution; no Node engine/version pin is supplied.

The supplied pack described main and feature/email-login-links as separate historical snapshots. Neither is this local branch. Historical claims are retained only as provenance in SOURCE-MAP.md; do not import their versions, utility paths, routes, security findings or commands without checking source. Do not switch branches, reset a checkout or reinstall dependencies merely to match an old document.
