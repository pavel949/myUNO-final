# SOP 06 · Production cutover — the console actions

**Who runs this:** the founder, or an operator with Supabase, Vercel and GitHub admin access.
**Why it exists separately:** every step below needs a console or a credential that no agent has. They are the remainder of Stage 1 of the production plan after T-044, T-047 and T-048 landed in the repository. Nothing here is optional and **§1 is a live security defect** — it is first for that reason, not for tidiness.

Work top to bottom. Each step says how to know it worked, because "I clicked the thing" is not evidence.

---

## 1. Close the public-API exposure (T-045) — do this first

**What is wrong right now.** Supabase serves every table in `public` over PostgREST to anyone holding the anon key — a key that ships to browsers. Four tables have row-level security **off**: `ownership_period`, `saved_unit`, `saved_search`, `area`. Two of them hold personal data — which homes a named person is watching, and the searches they saved.

**Why it happened, which matters more than the fix.** RLS was applied across the database in August 2026 **by hand in the dashboard**, so the decision never entered the repository. Every table created by a migration since was born exposed and nothing noticed for months. The repository fix (`20260824000021_rls_every_table`) plus `rls.integration.test.ts` — which fails the build if any table lacks RLS — is what stops that recurring. Running the SQL by hand again without deploying the migration would recreate the exact condition that caused this.

**Do:**

```bash
# From a trusted machine, with the production session-pooler URL.
# Never paste this string into a file that lives in the repository.
DATABASE_URL="<production session pooler URL>" npx prisma migrate deploy
```

Or, if you only have the dashboard: SQL Editor → paste `scripts/supabase-2026-08-24-rls-and-transfer.sql` → Run. It is safe to run twice, and that was tested rather than assumed.

**Evidence it worked:**
- Supabase → Advisors → Security linter reports **zero** ERROR entries. The four named tables must be gone from it.
- `npx prisma migrate status` against production reports up to date, with no pending migrations.

---

## 2. Verify `ENCRYPTION_KEY` before anything else touches passports (D-13)

**This is the one item with no second chance.** Passports are encrypted at the application layer with AES-256-GCM. Change or lose this key and every stored passport becomes permanently unreadable — there is no recovery, no support ticket, no re-derivation.

**Do, in this order:**

1. **Find out whether production already holds encrypted data.** This decides whether the key can still be rotated at all:
   ```sql
   SELECT count(*) FROM tm30_filing;
   ```
   Non-zero means the key is now immutable. Stop considering rotation.
2. Confirm `ENCRYPTION_KEY` is set in Vercel **Production**, and that it is 64 hex characters.
3. Confirm it is **identical** in staging, or you will have two environments that cannot read each other's data.
4. Confirm it exists **offline, in a physical vault** — not only in Vercel. Vercel is where it is used, not where it is kept. An account lockout with no offline copy is the same outcome as losing the key.

**Evidence it worked:** you can state, from having looked, the row count from step 1 and that a written copy exists somewhere that is not a computer.

---

## 3. Rotate the leaked production credential (T-046)

**What is wrong.** A production database connection string is sitting in developer `.env` files. This was flagged in an earlier pass and never resolved. A production credential in a developer file is a credential to **rotate**, not to tidy — deleting the file does not un-share what has already been shared.

**Do:**
1. Supabase → Settings → Database → **Reset database password**.
2. Rebuild the **session pooler** connection string with the new password. It must be port **5432**, and the username must be `postgres.burcnghheyzbzffzgmjz`, not `postgres`. Never the IPv6-only `db.<ref>.supabase.co` host.
3. Set it in Vercel for Production, Preview and Development. **Only** in Vercel.
4. Redeploy (Deployments → ⋯ → Redeploy, cache off since env vars changed).
5. Tell anyone who has ever had a copy that the old one is dead, and have them delete their local `.env` copies.

**Evidence it worked:**
```bash
curl -sS https://my-uno-final.vercel.app/api/health
# expect: {"status":"ok","db":"ok"}
```
A `503 {"status":"degraded","db":"unreachable"}` means the new string is wrong or the redeploy has not landed.

---

## 4. Turn on alerting and uptime (T-049)

`reportError` (`src/lib/observability.ts`) already pushes every unexpected 5xx **and every scheduler job failure** to `ALERT_WEBHOOK_URL`. With the variable unset it is a correct no-op, which is why nothing has been paging.

**Do:**
1. Create a Slack incoming webhook (minutes) — or anything that accepts a JSON POST with a `text` field.
2. Set `ALERT_WEBHOOK_URL` in Vercel Production. Redeploy.
3. Point an external uptime monitor at `https://my-uno-final.vercel.app/api/health`, which exists for exactly this. Alert on non-200.

**Known limitation, worth writing into the incident playbook now rather than discovering it at 3am:** this is a first version with no retry, no queue and no deduplication. A genuine incident storm will flood the channel. That is acceptable for a pilot; it is not acceptable to be surprised by it.

**Evidence it worked:** a deliberately triggered 5xx appears in the ops channel, and pausing the Supabase project fires the uptime alert.

---

## 5. Enable the real scheduler (T-047)

The repository now carries `.github/workflows/scheduler.yml`, which drives `/api/cron/run-frequent` on doc 15's real cadence for free. It does nothing until it is configured.

**Do:**
1. GitHub → Settings → Secrets and variables → Actions:
   - **Secret** `CRON_SECRET` — exactly the value already set in Vercel.
   - **Variable** `APP_BASE_URL` — `https://my-uno-final.vercel.app`, no trailing slash.
2. Actions tab → Scheduler → **Run workflow** manually once, and confirm it goes green.
3. Wait for two or three scheduled ticks and confirm they fire on their own.
4. **Only then** set `SCHEDULER_MODE=external` in Vercel and redeploy. Setting it before the workflow is confirmed firing will paint the admin scheduler panel red on a schedule that is working as configured, which teaches people to ignore the panel.

**Evidence it worked:** `/app/admin/scheduler` shows `booking_lifecycle`, `tm30_escalations` and `ical_sync` green with a last-run timestamp minutes old, not hours.

**Two caveats about GitHub's scheduler, both real:** scheduled workflows are best-effort — they queue behind platform load, fire late, and can be skipped entirely under peak. And **GitHub disables scheduled workflows in a repository with no activity for 60 days.** On a quiet repo, check the Actions tab before trusting the cadence.

---

## 6. Enable backups (T-048)

`.github/workflows/backup.yml` takes a nightly dump, restores it into a scratch Postgres, asserts it is intact, and only then stores it encrypted. It does nothing until it is configured.

**Do:**
1. Create the backup role — **not** the application's credential:
   ```sql
   CREATE ROLE backup_reader LOGIN PASSWORD '<generated>';
   GRANT pg_read_all_data TO backup_reader;
   ```
   `pg_read_all_data` reads through RLS without ownership: what a dump needs, nothing more. A compromised backup credential then leaks a copy of the data, which is bad; it cannot alter or destroy the live database, which is worse.
2. GitHub → Actions secrets:
   - `BACKUP_DATABASE_URL` — the connection string for `backup_reader`.
   - `BACKUP_PASSPHRASE` — `openssl rand -base64 48`. **Vault this like `ENCRYPTION_KEY`.** Lose it and every stored dump is permanently unreadable.
3. Run the workflow manually once and read its run summary: table count, migration count, and the per-table row counts.
4. **Walk the recovery runbook once, on purpose** (doc 15 §5) — download the artifact, decrypt it, restore it into a scratch database. The first time anyone runs those steps should not be during an incident.

**Evidence it worked:** a green run whose summary reports the full schema restored, and one operator who has personally decrypted and restored an artifact.

---

## 7. Confirm what the provider tier actually gives

The founder ruled against a paid tier for now, and §6 above is the compensating control. Two things are still worth knowing rather than assuming: what backup coverage and what PITR window, if any, the current Supabase tier provides. Check the dashboard and write the answer into `docs/launch_checklist.md`.

**Revisit this before the ownership/title work lands.** Title deeds, lease terms and foreign-quota positions are the most legally sensitive data the platform will ever hold, and the artifact-based backup shares a failure domain with the code. That is adequate for a cash pilot on stays; it is thinner than it should be under title records.

---

## When all seven are done

Re-run `docs/launch_checklist.md` §2 and §3 and update the rows with what you found. Anything you could not verify stays ❓ — the checklist's value is that nothing in it is ticked on the strength of looking likely.
