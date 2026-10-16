# Release evidence and operator sequence

> **Датированный отчёт / evidence конкретного среза.** Текущее [описание системы](../../current/SYSTEM.md) и [матрица реализации](../../current/IMPLEMENTATION_STATUS.md); production факты ниже относятся к указанной дате/окружению.

Code baseline [main CI](https://github.com/pavel949/myUNO-final/actions/runs/38881807483): all5956 tests /548 files, lint/types/build/migration replay/drift passed. Follow-up local: 11 focused tests +4 migration-policy tests passed; actual PostgreSQL regression and full CI pending PR. Do not transfer the old CI result to the follow-up commit.

## Production stage

1. Configure GitHub repository secrets BACKUP_DATABASE_URL (dedicated read-only backup connection to burcnghheyzbzffzgmjz; not the app credential) and BACKUP_PASSPHRASE. Retain the passphrase in the operator's password manager independently of repository/artifacts. Existing DATABASE_URL secret must identify that same production project using direct/session port5432.
2. Run Production migration (backup required) on reviewed main. It requires a successful push CI for the exact SHA and unchanged main after backup. Backup must finish dump, scratch restore, verification, encryption and storage before the protected production job can execute Prisma migrate deploy.
3. The runner validates target, unfinished migrations, exact pending allowlist, historical checksums and financial snapshot parity. No db push, MCP migration, ledger repair or grant creation. Failure stops code promotion; do not repair financial rows to make parity pass. Concurrent real business writes require operator reconciliation.
4. Review content gate before Vercel build: 4213 existing needs_review rows, plus new blocked-state key if registries are seeded. The new key is staff.unified_calendar.blocked (EN/RU/TH draft). Do not bulk-approve or disable review silently. Seed registries separately through the existing reviewed operator path; never demo seed.
5. Stage a production-environment Vercel build of tested main without alias assignment; verify migration ledger and health. Promote only that build; confirm public alias serves exact SHA and /property, scoped APIs and photo transport.
6. Real photo acceptance on dedicated nonpublic draft: small PNG/JPEG and valid >4.5MiB ≤8MiB photo, upload→finalize→save→reload, repeated finalize same MediaAsset, interrupted response recovery, malformed MIME/signature, >8MiB rejection, revoked/foreign identity denial. Preserve signed URLs/tokens outside logs and traces. Remove only dedicated test objects via supported scoped actions.
7. Verify PMS positive and negative workflows on isolated fixtures; inspect production only through permitted staff sessions. Do not create fake payments or change actual bookings to manufacture acceptance.
8. Compare security/performance advisor counts, aggregate loop metrics, all migration ledger rows, JobRun cadence, logs and alias SHA. Code rollback targets the previous READY deployment; additive role columns stay. Do not delete historical rows or reverse external payments automatically.

## Runtime evidence

[Scheduler repaired and dispatched](https://github.com/pavel949/myUNO-final/actions/runs/38889878798) returned HTTP200: booking_lifecycle, tm30_escalations, ical_sync all ok; SQL confirms fresh successful production rows. Before repair the workflow was disabled. Other daily jobs last succeeded 2026-10-15 19:25 UTC. Recurring-tick observation and scheduler-health mode still require verification.

Public GET health/home/login200; /property and /property/content404; direct-upload404. Ops route200 is transport only, not authenticated UX proof. No production migration or Vercel code deployment was executed while backup/restore prerequisites failed. Full operating readiness: **NO-GO** until the above gates have real evidence.

Exact-main browser rerun [38889878602](https://github.com/pavel949/myUNO-final/actions/runs/38889878602) completed successfully. This validates main436dd935, not the subsequent maintenance fix.

Supabase advisors before/after: security INFO120, WARN7 (5 function_search_path_mutable, 2 extension_in_public); performance INFO153 (30 unindexed FK, 1 no PK, 122 unused indexes). No new notices from this task; the existing seven warnings remain unresolved. Server-only RLS without policies is expected for this Prisma topology.
Remediation: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable and https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public
