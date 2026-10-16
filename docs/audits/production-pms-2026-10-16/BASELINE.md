# Production PMS baseline — 2026-10-16

Assessed repository `pavel949/myUNO-final`; main `436dd93567e4647e15c04fdafea850e0e103bf3a`. Follow-up fixes are on `fix/production-release-pms-20261016` until merged. Open PRs #283, #275, #279, #277 and #274 were inspected as separate work; none were silently merged.

Production alias https://my-uno-final.vercel.app serves **408ad99abfae9e7e67b6f518a736b751d72a7283**, Vercel deployment `dpl_4hoKajzkxCMc1nRrp5LKzoBmSW7v` READY. Most recent attempted production deployment `dpl_9LoLVrceGWhBFooJso6JyHUwHxft` is ERROR at 94b280e5. Project `prj_GonhJLt1m9T060dxDBnSZtuiiWYj`, team `team_yhQPVQRquxdAw8pzvG4Lvfe1`; lookup by project ID succeeds. Supplying the team ID to one name lookup returned 404. Git deployments are disabled in vercel.json.

Database: only Supabase `burcnghheyzbzffzgmjz`, ACTIVE_HEALTHY, PostgreSQL 17.6, Mumbai. 94 repository migration files; two pending employee-role migrations. No unfinished migration. Legacy orphan ledger entries were preserved. Fourteen apparent checksum differences are LF/CRLF equivalence. One exact historical checksum differs only because five comments were removed in git 8dec5d51 → fa1b2bff. The release policy accepts that exact pair; it never repairs history.

Access: Supabase read-only SQL, GitHub and Vercel connectors available. No production database credential was copied into the workspace. GitHub Actions has DATABASE_URL and CRON_SECRET, but no BACKUP_DATABASE_URL or BACKUP_PASSPHRASE. No production application login was supplied. Real Blob upload is blocked because the new endpoint is absent from the deployed SHA.

Code evidence: [main CI](https://github.com/pavel949/myUNO-final/actions/runs/38881807483) passed 5956 tests / 548 files, lint, types, production build, fresh migration replay and drift checks. Browser evidence for the identical tree: run 38880480161, 9 runners / 112 steps. Additional exact-main browser run 38889878602 was started during this assessment; see RELEASE_EVIDENCE for final result. Synthetic browser fixtures are not production transactions.
