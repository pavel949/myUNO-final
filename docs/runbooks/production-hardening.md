# myUNO production hardening — Vercel URL only

The application is Next.js 14 + Prisma on Supabase PostgreSQL, not a Supabase Auth/Vite client. No custom domain is required for the current stage: use the existing HTTPS Vercel production URL as `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL`. A Vercel URL is not private by default; configure Deployment Protection separately if access is intended to be restricted.

## Release gates

1. CI: lint, production build, tests, complete migration replay, schema drift, and full public-Data-API privilege check must pass.
2. GitHub: protect `main`, require CI, and prohibit force pushes. Keep previews and production credentials separate.
3. Application: `/api/health` checks database availability. `/api/health?strict=1` also checks deployment configuration; output exposes statuses, not secret values. A 503 means not ready.
4. Credentials: configure `CRON_SECRET` and `APP_BASE_URL` in GitHub Actions (URL is the existing Vercel URL); configure the same cron secret in Vercel. Keep `SCHEDULER_MODE=vercel-daily` until the external schedule demonstrably succeeds.
5. Backups: configure GitHub secrets `BACKUP_DATABASE_URL` (dedicated read-only user) and `BACKUP_PASSPHRASE` (independently vaulted), then run a workflow_dispatch backup, verify scratch restoration and download/decrypt/restore the actual retained artifact. Configure a second off-account immutable destination before live owner or payment data.
6. Monitoring: set `ALERT_WEBHOOK_URL`, and install an external synthetic monitor for `/api/health` and a secure internal check for strict health.
7. Data API: app tables are served exclusively through server-side Prisma; migration `20260928130000_close_prisma_data_api` removes accidental direct anon/authenticated grants and prevents future grants by the migration role. Re-run Supabase advisors and verify privileges after deploy.
8. Deploy with backward-compatible database migrations; preserve existing booking and payment data. Do not restore, reset or reseed the production database as part of an application rollback.

## Remaining external controls

The connected GitHub API cannot set repository Actions secrets or branch protection, and the connected Vercel account currently returns no accessible project. These controls require account-level access. This runbook does not describe them as completed until the actual settings and workflow results have been verified.
