# Scheduler and mail side effects

## Source landmarks

`src/cron/index.ts` schedules the unified scheduler and snoozed-alarm service daily with `node-cron` expression `15 0 * * *`, without an explicit timezone option. `src/cron/scheduler.service.ts` loads `SchedulerModel`, checks allowed days/date ranges/repetition and `last_execution_date`, acquires a persisted atomic lease via findOneAndUpdate, creates work orders, updates execution count/date and releases the lease for its instance. The lease uses cron_lock_acquired_at/cron_lock_instance_id and SCHEDULER_LOCK_TTL_MS (default ten minutes). `src/_config/mailer.ts` provides email operations, and work-order service invokes email-related functions.

## Operating rules

1. Confirm business timezone explicitly. `new Date().toISOString()` uses UTC while local `getDay()` / `toDateString()` uses host timezone; test around day boundaries and daylight-saving transitions where relevant.
2. Preserve the existing atomic lease; do not describe this checkout as lacking a lock. The `alreadyExecutedToday` check happens on a loaded schedule before lease acquisition. Review stale snapshots, lease expiry during long work, crash recovery and occurrence-level deduplication before claiming duplicate prevention across workers/retries. A lease alone does not establish exactly-once execution.
3. Track scheduler executions and retry policies with safe structured metadata; do not log mail credentials, message bodies or recipient lists in plaintext.
4. Plan for DB disconnects, partial `createWorkOrder` failure, email failure after DB commit, and a crash before execution checkpoint. Define whether to retry or compensate.
5. Never add an unbounded or duplicate cron registration. Confirm bootstrap only invokes registration once per worker or use an appropriate leader/lock mechanism.
6. Mail should be dispatched to approved recipients only, with templates escaped/sanitized and user-specific credentials never reused across recipients.
7. In tests, freeze clock, stub the mail transport, isolate MongoDB and assert schedule eligibility, idempotency, retries and error propagation; **do not send real email**.

## Decisions for affected scheduler changes

Resolve applicable decisions from source and requirements before changing scheduler behavior: business timezone, execution-state ownership, occurrence identity, retry semantics, partial mail/mapping failure and worker topology. Document genuinely missing decisions; these questions do not block an unrelated instruction edit or require confirmation for behavior the user already specified.
