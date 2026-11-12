# Scoped source instructions

In `src/`, obey root `AGENTS.md` and the active branch architecture. Confirm `src/app.ts` middleware order before new router or global middleware. Keep all protected API routes authenticated, authorized and tenant-scoped. Maintain existing status/error envelope and test relevant negative cases for behavior changes. Change startup/config/cron only when the task needs it; trace their side effects and avoid unrelated edits. Instruction-only updates use static documentation checks.
