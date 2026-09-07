# SOP 06 · Production cutover — the console actions

**Who runs this:** the founder, or an operator with Supabase, Vercel and GitHub admin access.
**Why it exists separately:** every step below needs a console or a credential that no agent has. They are the remainder of Stage 1 of the production plan after T-044, T-047 and T-048 landed in the repository. Nothing here is optional and **§1 is a live security defect** — it is first for that reason, not for tidiness.

Work top to bottom. Each step says how to know it worked, because "I clicked the thing" is not evidence.

---

## 0. Unblock the migration chain — **nothing else deploys until this is done**

**Verified against the live database 2026-09-06, and reproduced locally end to end.**

Production is **nine migrations behind** the repository, and a plain `prisma migrate deploy` **fails on the first one**:

```
Error: P3018 ... Database error code: 42710
ERROR: type "DisputeSubjectType" already exists
Migration name: 20260825044246_disputes
```

**Why.** The `dispute` table and its enum exist in production, but `20260825044246_disputes` is not recorded in `_prisma_migrations`. They were applied by hand — the same failure mode as the RLS incident in §1, and for the same reason: a change made in the dashboard never entered the migration history. The migration's SQL has no `IF NOT EXISTS`, so Prisma tries to create what is already there.

The production table was compared column by column against the migration and **matches exactly** — all eleven columns, same types, same nullability. That is what makes the remedy below safe rather than a guess.

**`postinstall`'s repair script does not fix this.** It clears a *failed* migration row (P3009), which lets the deploy try again — and fail again identically. Left alone, this loops.

**Do, in this order:**

```bash
# If a deploy has already been attempted and failed, clear the failed row first:
DATABASE_URL="<production session pooler URL>" npx prisma migrate resolve --rolled-back 20260825044246_disputes

# Record the hand-applied migration as applied, without re-running its SQL:
DATABASE_URL="<production session pooler URL>" npx prisma migrate resolve --applied 20260825044246_disputes

# Then the rest of the chain applies normally:
DATABASE_URL="<production session pooler URL>" npx prisma migrate deploy
```

The remaining eight were checked for the same hazard and are safe to run as they are: `dispute_rls` is an idempotent loop, both `role_assignment` constraint migrations add their checks `NOT VALID` so existing rows cannot fail them, and the objects the others create do not yet exist.

**Evidence it worked:** `prisma migrate deploy` reports "No pending migrations to apply", and `prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-schema-datasource prisma/schema.prisma` prints an empty migration. One row for `20260825044246_disputes` will show `finished_at` null with `rolled_back_at` set — that is the expected marker from the resolve, not a blocker.

**How this was proven, so it does not have to be discovered live:** a scratch database was built to production's exact state — the chain applied up to `20260824000022`, then the disputes SQL applied by hand with no migration row. A deploy against it reproduced the P3018/42710 failure verbatim; the three commands above then took it to a clean, fully-migrated, zero-drift database.

---

## 1. ~~Close the public-API exposure (T-045)~~ — **DONE, verified 2026-09-06**

**Checked against the live database, not the checklist.** `20260824000021_rls_every_table` is recorded in `_prisma_migrations` with `finished_at = 2026-08-24 06:14:01+00`, and a direct query returns **zero** tables in `public` without row-level security (78 of 78 enabled). Supabase's security advisor returns **zero ERROR-level lints**; the `rls_enabled_no_policy` entries it does return are INFO, and that is the intended posture — RLS on with no policy denies the anon key everything, while the application connects as the owner through Prisma rather than through PostgREST.

The four tables this step was written about — `ownership_period`, `saved_unit`, `saved_search`, `area` — are all locked. **Nothing to do here.** The step is kept rather than deleted because the record said otherwise for weeks, and the correction is the useful part.

Two WARN-level advisor items remain, neither a defect and neither blocking: the `citext` and `btree_gist` extensions are installed in the `public` schema rather than their own. Worth tidying when convenient.

*Original text follows.*

**What was wrong.** Supabase serves every table in `public` over PostgREST to anyone holding the anon key — a key that ships to browsers. Four tables had row-level security **off**: `ownership_period`, `saved_unit`, `saved_search`, `area`. Two of them hold personal data — which homes a named person is watching, and the searches they saved.

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

**Status 2026-09-07 05:03 UTC — the rotation is under way and the new string is not yet right.**
`/api/health` returns `503 {"status":"degraded","db":"unreachable"}`, and the two production
builds either side of the change name two different faults, which is the useful part:

| Build | Time (UTC) | What Prisma said |
|---|---|---|
| `3247d37` | 04:56 | `Authentication failed … the provided database credentials for "postgres" are not valid` |
| `f7c8022` | 05:01 | `Error validating datasource "db": the URL must start with the protocol "postgresql://" or "postgres://"` |

The first says the value parsed as a URL but the password was rejected. The second says the value
no longer parses as a URL at all. Both point at the same root cause: the new password contains a
character that is not URI-safe — `@ : / ? # [ ] %` all terminate or re-interpret parts of a
connection string — or the value was pasted with the quotes Supabase shows around it.

**Narrowed 05:12 UTC — it is the Production variable only.** The preview
deployment of the same commit answers `200 {"status":"ok","db":"ok"}`, while
production answers `503`. So Preview and Development still hold a working
connection string and only the Production value is wrong.

Two things follow. First, the fix is a single variable, not a broken database —
nothing else needs touching. Second, and more important: **if the old string
still works in Preview, the credential T-046 exists to kill is still live.** A
password reset invalidates it everywhere at once; a working Preview means either
the reset has not happened yet, or Preview holds a different string that is also
valid. Finish the reset, then set the new value in all three environments — the
point of the rotation is that the leaked one stops working, not that production
stops using it.

**Resolved 2026-09-07 ~12:00 UTC — and the reset did happen.** Production now
answers `200 {"status":"ok","db":"ok"}`. The picture has also inverted: at 05:12
Preview was healthy and Production was not; at 12:09 Production is healthy and
**Preview** answers `503 db:unreachable`.

That inversion is the evidence worth keeping. It means the Supabase password was
genuinely reset — Production was given the new string, and Preview is still
holding the old one, which no longer authenticates. So the leaked credential
T-046 exists to kill **is now dead**, which the earlier note could not yet
confirm.

**Still to do:** set the new connection string in the Preview and Development
environments too (or give Preview its own database). Until then every preview
deployment renders with no database, which makes reviewing a PR against a real
screen impossible — and a preview that is broken for an unrelated reason is how
a preview that is broken for a *related* reason gets waved through.

**If it needs resetting again:** and either keep it to letters, digits, `-` and `_`, or
percent-encode it in the URL (`@` → `%40`, `#` → `%23`, `/` → `%2F`). Paste the value with no
surrounding quotes and no trailing newline. Then redeploy with cache off and re-run the health
check above.

Note the build tolerates this by design and should not be read as "fine": the migration repair step
prints `[repair] could not run repair - leaving the database untouched`, and the content gate prints
`Database unreachable; skipping gate check`. Both are deliberate — a build must not fail because a
database is briefly away — but it means **a green build does not prove the credential works.**
`/api/health` is the check that does.

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

## 8. The money data check — before the T-070/T-071 migrations run

**No longer hypothetical — confirmed in the live database 2026-09-06. All five production units are priced at 1/100 of their rate.**

| Unit | `base_nightly_thb` | Reads as | Almost certainly meant |
|---|---|---|---|
| AG-07 Courtyard Home | 5600 | ฿56 / night | ฿5,600 |
| LB-11 Lagoon View | 3900 | ฿39 / night | ฿3,900 |
| LB-25 Family Loft | 7100 | ฿71 / night | ฿7,100 |
| PH-101 Sky Villa | 9800 | ฿98 / night | ฿9,800 |
| PH-202 Garden Suite | 6200 | ฿62 / night | ฿6,200 |

All five are `status = live`. **A ฿5,600 villa is currently bookable at ฿56 a night.**

**⚠ Order matters, and getting it wrong is worse than doing nothing.** Before T-071, the display bug cancelled the data bug: search rendered raw satang with a ฿ sign, so `5600` read back as "฿5,600" and looked right. T-071 fixes the display. **Deploying that fix without correcting the data makes every villa show ฿56 — and it is bookable at ฿56, because the stored rate is what the booking engine charges.** Correct the data in the same window as the deploy, or before it.

The correction is `base_nightly_thb = base_nightly_thb * 100` for those five rows, but **confirm the intended rates with whoever entered them first** — this is an assumption about someone's intent, not an arithmetic fact, and it is cheap to confirm and expensive to guess.

`crm_opportunity` is **empty** (0 rows), so the T-070 migration's multiplication is a no-op and its stated assumption is moot. Nothing to check there.

The remaining write paths are still worth a look, since the same class produced them:

Query each and eyeball the values against what the business actually charges:

| Table / column | Written by | What a wrong row looks like |
|---|---|---|
| `crm_opportunity.value_thb` | the admin CRM pipeline form | **checked: 0 rows, nothing to do** |
| `unit.base_nightly_thb` | the admin "create unit" form (T-071) | **checked: all 5 rows wrong, see above** |
| `service.base_price_thb` | a provider's own price edit (Q49) | a cleaning at `800` (= ฿8) rather than `80000` |
| `unit_engagement.noi_cap_annual_thb` | the admin onboarding form (Q50) | an annual cap that reads sensible in baht |

Correct anything implausible and record what was changed and why. Units are the urgent one: a unit priced at 1/100 of its rate is bookable at that rate.

**Also check what the seeds put there.** `scripts/seed-three-projects.ts` and `scripts/seed-real-data.ts` wrote baht into the satang column until T-071, and `docs/VERCEL-SETUP.md` instructs running the first of them — so any environment seeded from that doc has every unit at 1/100 of its rate. Re-seeding from the corrected scripts is simpler than patching row by row, if the environment can take it.

---

## When all eight are done

Re-run `docs/launch_checklist.md` §2 and §3 and update the rows with what you found. Anything you could not verify stays ❓ — the checklist's value is that nothing in it is ticked on the strength of looking likely.
