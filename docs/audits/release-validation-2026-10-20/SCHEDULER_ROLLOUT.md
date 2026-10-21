# Guarded five-minute scheduler rollout

Prepared and tested; **not activated in production**.

The current Vercel team is Hobby, so a five-minute Vercel Cron expression cannot be assumed deployable. GitHub's configured five-minute schedule was independently observed with multi-hour gaps. Supabase's documented pg_cron + pg_net pattern supplies a database-hosted trigger without inventing a paid-plan approval.

## Prerequisites and boundaries

- Target only Supabase `burcnghheyzbzffzgmjz` and Vercel `prj_GonhJLt1m9T060dxDBnSZtuiiWYj` / `my-uno-final.vercel.app`.
- Preserve the existing application cron authentication and Vercel deployment protection. Never disable either to make the scheduler pass.
- The operator securely provisions Vault entries named `myuno_scheduler_cron_secret`, `myuno_scheduler_protection_bypass`, `myuno_scheduler_alert_webhook`. The first two must match the intended production deployment; the last is the chosen alert destination. Do not paste secret values into source, logs or this report. No credentials were copied during this task.
- Review and enable pg_cron and pg_net on this project. Install [scheduler-control.sql](../../../scripts/sql/scheduler-control.sql) through the reviewed operations rollout. It creates only private `myuno_ops` control tables and SECURITY INVOKER functions. Public/anon/authenticated access is revoked transactionally; application migration history is not rewritten.

## Acceptance before activation

1. Invoke `SELECT myuno_ops.dispatch_frequent()` once. The request uses the existing cron endpoint, protected by both credentials. It never writes booking/finance facts directly.
2. After the asynchronous response arrives, invoke `SELECT myuno_ops.check_frequent()`. Require HTTP success, every expected result, and persisted successful JobRun records whose timestamps follow the verified dispatch. A 2xx alone cannot establish success.
3. Confirm successful delivery to the configured alert destination with an approved controlled test. The function records enqueue time/cooldown; pg_net enqueue does **not** prove external receipt. Inspect response metadata or destination receipt separately without publishing its URL or contents.
4. Run [scheduler-activate.sql](../../../scripts/sql/scheduler-activate.sql). It refuses absent extensions, credentials, a recent successful dispatch or a healthy watchdog. It schedules `myuno-frequent-v1` every five minutes and `myuno-frequent-watch-v1` every minute.
5. Observe at least three consecutive five-minute windows. Verify each booking_lifecycle, tm30_escalations and ical_sync JobRun, cron.job_run_details and HTTP outcomes, plus missing-run alert and recovery receipt. Only then set SCHEDULER_MODE=external and rebuild/release through normal controls.

Watchdog thresholds are 12 minutes for booking lifecycle and 25 minutes for TM30/iCal. The watchdog uses current persisted records and HTTP failure state, never a static configured-mode label. An incident alerts once, repeats at most every 30 minutes and enqueues recovery notification once.

Pending requests suppress overlapping enqueue for five minutes. A transaction advisory lock prevents concurrent enqueue/watchdog races. HTTP timeout is three minutes. Timeout retries remain at-least-once: they do not prove the previous remote execution stopped, so domain jobs must retain their idempotency/transition guards. Existing application concurrency/replay regressions passed. Disable the redundant frequent GitHub schedule after takeover; retain daily/manual fallback and nightly schedules. Do not claim universal exactly-once execution.

## Recovery and rollback

Unschedule only `myuno-frequent-v1` and `myuno-frequent-watch-v1` via cron.unschedule. Retain control/job evidence. Restore prior scheduler mode through normal deployment controls; never alter business rows or migration checksums to roll back a trigger. Database failure also stops a database-hosted watchdog, so a separate external availability monitor remains necessary for that failure domain.

Local verification: start the disposable container `myuno-release-postgres` with the test role, create `myuno_scheduler_test`, initialize compatible anon/authenticated roles, then run `MYUNO_SCHEDULER_SQL_TEST=isolated node --test scripts/scheduler-sql.integration.test.mjs`. All 13 tests passed. The test's HTTP/Vault tables are synthetic adapters, not live external services.

Official references: [scheduled functions](https://supabase.com/docs/guides/functions/schedule-functions), [pg_net](https://supabase.com/docs/guides/database/extensions/pg_net). Response queues are transient; the private delivery ledger retains bounded status metadata for seven days.
