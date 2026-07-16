# Preflight Audit · myUNO-final · 2026-07-16

**Read from:** Passes 1–4 (inventory, flows & copy, database readiness, copy sweep).

---

## VERDICT

**YES, WITH BLOCKERS** — Supabase-as-Postgres wiring is architecturally sanctioned, but **three critical blocker issues must be resolved before any database swap or Vercel/prod deploy:**

1. **Test suite may wipe live database** — `src/test/util.ts:6` falls back to `DATABASE_URL` (no `DATABASE_URL_TEST` guard); `resetDb()` hard-deletes all tables. Running `npm test` locally with the current `.env` **wipes the live Neon database**.
2. **Encryption key loss will orphan all passports** — all TM30 verification documents are AES-256-GCM encrypted with `ENCRYPTION_KEY` from `.env:4`; a different key on Supabase/prod causes permanent decryption failure for every historical passport.
3. **Real secrets exposed in working tree** — four production-grade secrets (Neon connection, encryption key, session secret, cron secret) are in `.env:1,4,5,6` (gitignored but in the filesystem, exposable on archive or copy).

---

## FINDINGS TABLE

Ranked by severity and scope.

| Rank | Category | File(s) | Finding | Impact | Fix |
|------|----------|---------|---------|--------|-----|
| **BLOCKER** | Test safety | `src/test/util.ts:6`, `.env:1` | No `DATABASE_URL_TEST` env var; tests fall back to live `DATABASE_URL` (Neon). `resetDb()` calls `deleteMany()` on all tables. | Running `npm test` in any dev environment **wipes the live Neon database** if `.env` is pointing there. CI only works because it sets `.DATABASE_URL` to a local test DB. | Add `DATABASE_URL_TEST` to `.env.example` and `.env` (a separate test DB URL), then guard `resetDb()` with `if (!process.env.DATABASE_URL_TEST) throw new Error(…)`. Verify `vitest.config.ts` loads it. |
| **BLOCKER** | Encryption | `src/lib/encryption.ts`, `.env:4`, `src/app/api/bookings/[id]/guests/route.ts`, `src/app/api/bookings/[id]/verify-passports/route.ts` | All TM30 passports encrypted with AES-256-GCM using `ENCRYPTION_KEY` from `.env:4`. Ciphertext stored as `iv:authTag:ct` in DB. A different key on swap (e.g., Supabase) causes auth-tag failure. | Every historical passport becomes **permanently undecryptable** if the key changes. TM30 verification history lost. Guest re-arrivals have no prior immigration record. | Carry the **exact same `ENCRYPTION_KEY` value** to Supabase/prod as a Vercel/Supabase env var. Document this in ops runbook. Never regenerate the key. |
| **BLOCKER** | Secrets hygiene | `.env:1,4,5,6` | Four real production-grade secrets present in uncommitted `.env` file: Neon connection string (w/ password), 64-hex `ENCRYPTION_KEY`, `SESSION_SECRET`, `CRON_SECRET`. | File is gitignored but physically on disk; exposable via `tar`, `scp`, backup/snapshot, accidental commit on different branch. | Rotate all four secrets on Supabase/prod live (generate fresh Neon pass, new encryption key [**does not break existing passports if done immediately before go-live**], new session secret). Commit only `.env.example` placeholders. |
| **MAJOR** | Architecture | `.github/workflows/ci.yml:61-66` (test step), `:44,58,63` (build step) | CI environment does **not** set `ENCRYPTION_KEY`. Any test or build step calling `encrypt()` throws. | Cryptographic tests are not running in CI; catch of encryption bugs deferred to prod runtime. | Add `ENCRYPTION_KEY: ${{ secrets.ENCRYPTION_KEY }}` to CI env vars (or use a deterministic test key in CI, different from prod). |
| **MAJOR** | Architecture | `.github/workflows/ci.yml` (overall) | **"Supabase Preview" environment** exists external to this repo (`docs/15_deployment.md:19` mentions it); **no Supabase wiring in `ci.yml` or any app code**. `DATABASE_URL` in CI points to local test `postgres:16`. | Supabase is "intended but unwired." Toggling `.env:1` from Neon to Supabase risks running the full schema/migration against a DB target that has never been tested in this repo's CI. | Wire Supabase into `ci.yml` as a parallel or gated job (spin up a Supabase test DB via `mcp__Supabase__create_branch`, run migrations, run tests, tear down). Verify schema portability once. |
| **MAJOR** | Operations | `vercel.json` (missing), `src/app/api/cron/*` | `sync-ical-imports/route.ts` exists but is **never scheduled** in `vercel.json`. Only `check-tm30-escalations` + `run-all` are scheduled. | OTA calendar imports never trigger in production. Bookings synced from Airbnb, Booking.com, etc. via iCal are never pulled in. Inventory desync. | Add `POST /api/cron/sync-ical-imports` to `vercel.json` schedule (e.g., hourly or every 6 hours, CRON_SECRET-guarded). |
| **MAJOR** | Operations | `src/modules/comms/notification.bus.ts` (in-memory), `src/api/notifications/stream`, `src/api/threads/[id]/stream` | Real-time notifications (SSE) use an **in-process memory bus**. On Vercel serverless or multi-instance deployments, publishers and subscribers land on different instances → **real-time delivery silently fails**. | Owners never get real-time notifications of new bookings, tickets, or messages. Messages from guests sit unnoticed. Staff alerts don't fire. | Replace in-memory bus with Redis pub/sub (ioredis client). Surface is unchanged; only `notification-bus.ts` swapped. Deploy requires adding `REDIS_URL` env var. |
| **MAJOR** | Secrets hygiene | CI | CI test/build steps **do not** set `ENCRYPTION_KEY` from secrets. | Any code path hitting `encrypt()` during CI throws. Tests for passport capture, verification cannot run. | Add `ENCRYPTION_KEY` to GitHub Actions secrets; inject into CI job env. |
| **MINOR** | Code quality | `src/app/libs/prismadb.ts:8` | Prisma logger set to `log:['query']` — logs full SQL incl. bound params (emails, phones, etc.) to stdout. Violates CLAUDE.md "never log PII." | PII appears in CI logs and Vercel Functions logs if anything fails. | Swap `log:['query']` for `log:['error']` or remove entirely. Use `src/lib/prisma.ts` (quiet) as the single Prisma instance instead. |
| **MINOR** | Data model | `schema.prisma:88-92, :1303-1305` | `RoleAssignment` carries `organizationId` + `providerId` FKs, but `enum RoleScopeType` only includes `platform/project/unit` — no `organization` or `provider` variant. Org/provider-scoped roles can't express their true scope. | Role permission matrix (doc 03) is incomplete for certain role types. Currently unused, but blocks future features. | Update `RoleScopeType` enum to include `organization`, `provider`. Regenerate Prisma client. |
| **MINOR** | PII | `src/modules/media/media.service.ts:42-43` | Dev passport images stored as data-URIs **inside the database** when `BLOB_READ_WRITE_TOKEN` is not set. Migrating that DB to Supabase copies PII images into Supabase. | PII images in production DB; Supabase retention/security policies apply. | In dev, set `BLOB_READ_WRITE_TOKEN` to point to a mock Blob storage (or S3/Cloudinary). Never store images as data-URIs in production. |

---

## PASS 2+3 — FLOWS & COPY SUMMARY

### Flow Verdicts

| Flow | State | Gaps | Verdict |
|------|-------|------|---------|
| **1. Guest booking** | card/cash/request all routed | **BLOCKER:** Request-to-book branch is **broken** — `requested` status has no approval surface (no API route to approve/decline), and booking is uncancellable (not in `cancellableStatuses`). Approved bookings rot until expiry. | **HOLDS WITH GAPS** |
| | | Trips list hardcodes English (`:81,91,105,111,144,151,159,174,182,190`); should load from content keys | |
| **2. Owner journey** | stay book, sell interest, statements, tickets | Portfolio owners get **no "book a stay" button** (`:298-354` omits it). Statements **dead-end** (no route to view); tickets **dead-end** (no `/tickets/[id]` route). MC "Manage" links to guest booking page, not MC management. | **HOLDS WITH GAPS** |
| | | Non-designed error UX (uses `window.alert()`, `window.location.reload()`). LatestStatementCard, OpenTicketsList, OwnerStayModal hardcode English | |
| **3. Services** | browse, order, fulfillment | No loading state during fetch; empty flashes momentarily | **HOLDS WITH GAPS** |
| **4. Language** | locale cookie, TH fallback | No mobile language switcher (hidden on small screens). **384 keys (71% of UI shell) have no TH** — Thai users see English everywhere (nav, auth, search, MC, staff, tickets). | **HOLDS WITH GAPS** |
| | | `/trips` list, `owner/` components, `home-space`, `LatestStatementCard` hardcode English | |
| **5. Staff/Ops** | checkin, checkout, cash, TM30 | All five states present, all actions wired, fully localized | **HOLDS** |

### Copy Audit

| Category | Finding |
|----------|---------|
| **Placeholder debris** | No `lorem`, `asdf`, `foobar`, fake phones, or fake public-facing emails in product code. One dead stub: "View Handbook →" button in home-space (no `onClick`). Permission check TODO in `announcement.service.ts` (not user-facing). All else intentional (CRM stubs, stripe mock, test fixtures). |
| **Banned marketing words** | **Clean.** Zero "delve", "tapestry", "seamless", "synergy", etc. in user-facing copy. "unlock" only in code comments. |
| **Trilingual parity** | **384 keys missing TH** (`UI_SHELL_KEYS` EN+RU only, marked `needs_review`). Coverage by namespace: 71% keys lack Thai translations. Thai users fall back to English for entire shell (nav, auth, search, MC, staff, tickets). COMMON_KEYS (156) are full RU/EN/TH. |
| **Consistency** | Brand: Clean (`myUNO` consistent). Currency: Inconsistent (owner page `Intl.NumberFormat('th-TH')`, others use browser-default `toLocaleString()`). Dates: Hardcoded `en-US` in 2 places; no RU-first policy. |
| **Claims** | **Clean.** No invented quantitative claims; occupancy/revenue figures wired to analytics rollup, not hardcoded. |

**Action:** TH UI shell (384 keys) needs translation before any public Thai launch. Request-to-book approval flow must be implemented before beta. Portfolio owner-stay button, statement detail route, ticket detail route needed. Dead links in MC need fixing.

---

## PASS 1 — INVENTORY SUMMARY

| Category | Finding |
|----------|---------|
| **Routes/Pages** | 39 routes across public, (public), (admin), (app) route groups. All server/client mix correct. Audience mapping complete. |
| **Forms/Data-Submitting Surfaces** | 18 surfaces (bookings, units, verification, tickets, messages, config, settings). 100% write to Prisma. No stubs found. |
| **Data-Rendering Surfaces** | 15 surfaces (dashboards, lists, tables). Data sources: Prisma via server actions (85%), /api fetches (10%), hardcoded (5% — fixtures in design/page.tsx only, marked internal). |
| **Configuration** | 50+ config keys registered (`src/modules/config/seed.ts`). All fee/rate/percentage math uses config-derived variables. **Zero hardcoded numbers** outside config. |
| **i18n Coverage (RU/EN/TH)** | 25 surfaces use content keys + `getLabels()`/`t()`. **11 surfaces still hardcode English**: `public/*` (master landing, audience pages — correct, marketing only), `design/page.tsx` (internal showcase), `trips/` trip-list heading, `in-stay/` home-space title, `verify-email/` confirmation text. All flagged for sweep or exemption from `no-literal-ui-text` lint. |

**Action:** Remaining English hardcodes (trips, in-stay, verify-email) are user-facing and need content keys in a follow-up. `design/page.tsx` and `public/*` can stay hardcoded (internal + marketing). No blockers.

---

## PASS 4 — DATABASE READINESS SUMMARY

### Database Targets in Play

| # | Name | Connection | In Repo Code? | CI? | Production? | Risk |
|---|------|----------|---|---|---|---|
| 1 | **Neon** | `.env:1` `ep-silent-credit-…neon.tech` | **Live** | No | Intended | **BLOCKER** (test fallback) |
| 2 | **Local CI Postgres** | `postgres:16@localhost/myuno_test` | No | **Yes** | No | OK (test DB, separate) |
| 3 | **Supabase** | Mentioned in docs, **unwired** | No | No | Intended | **MAJOR** (not tested) |
| 4 | **Prisma Compute** | External state, P3009 stuck | No | No | External only | **MAJOR** (pre-existing, unrelated) |

### Schema & Spine

- **Spine confirmed:** Project → Unit → Identity → Roles enforced in schema (`schema.prisma:656-1296`).
- **Single squashed migration:** `0_init/migration.sql` (1789 lines). Not a chain. `migration_lock.toml` = `postgresql`. Clean Supabase apply once.
- **Extensions:** `citext` (identity.email, case-insensitive unique). Supabase supports; `create extension` will succeed.
- **No vendor lock:** Plain `url=env("DATABASE_URL")` datasource. Supabase-as-Postgres behind `DATABASE_URL` is cleanly portable.

### Identity / PII Handling

- **Email/phone keying:** CITEXT (case-insensitive, portable).
- **Passports:** AES-256-GCM encrypted (`src/lib/encryption.ts`), ciphertext stored as text in DB.
  - **BLOCKER:** A different `ENCRYPTION_KEY` on Supabase → **all passports permanently undecryptable** (GCM auth-tag failure).
- **Passport images:** Data-URIs in `booking_guest` when `BLOB_READ_WRITE_TOKEN` unset (dev fallback). Migrating the DB copies PII.
- **Logging:** `src/app/libs/prismadb.ts:8` logs full query text (PII leak). Should use `src/lib/prisma.ts` (quiet) instead.

### Integration Points

| Point | Status | Prod Env Vars Needed |
|-------|--------|---------------------|
| Payments (cash) | Live | None |
| Payments (provider) | Half-wired (mock) | `PAYMENT_PROVIDER`, `STRIPE_*` (optional) |
| Media storage | Half-wired (data-URI in dev) | `BLOB_READ_WRITE_TOKEN` (prod) |
| Email | Half-wired (Resend if key, else console) | `RESEND_API_KEY`, `EMAIL_FROM` (optional) |
| **Notifications/SSE** | **In-memory bus (broken on serverless)** | None (but needs Redis in prod) |
| **iCal sync** | Code exists, **never scheduled** | None (but needs cron scheduling) |
| CRM, WhatsApp/Telegram | Stub | Deferred (Q-20) |
| Analytics | Live, DB-backed | None |
| Cron | Live, CRON_SECRET-gated | `CRON_SECRET` |

### Pre-Supabase Swap Checklist

- [ ] Set `DATABASE_URL_TEST` in `.env` and `.env.example`; guard `resetDb()` with it.
- [ ] Verify `ENCRYPTION_KEY` is carried verbatim to Supabase/prod (no regeneration).
- [ ] Add `ENCRYPTION_KEY` to CI GitHub Actions secrets; inject into job env.
- [ ] Swap `src/app/libs/prismadb.ts:8` `log:['query']` → `log:['error']` or remove.
- [ ] Wire Supabase into `ci.yml` (or document why it's tested separately).
- [ ] Add `sync-ical-imports` to `vercel.json` schedule.
- [ ] Plan Redis deployment for real-time notifications (or async fallback in single-instance mode).

---

## VERTICAL SLICE RECOMMENDATION

**Scope: Database swap from Neon → Supabase (single-instance, no Redis yet).**

1. **Fix test safety** (1–2 hours): Add `DATABASE_URL_TEST`, guard `resetDb()`. Run full test suite locally against test DB. Verify CI still passes.
2. **Fix encryption setup** (30 min): Document that `ENCRYPTION_KEY` must be identical on swap. Create Vercel env var before Supabase go-live.
3. **Fix secrets rotation** (30 min): Generate fresh secrets (Neon pass, session secret, cron secret); keep encryption key identical. Commit placeholder `.env.example`.
4. **Verify CI** (1 hour): Add `ENCRYPTION_KEY` to GitHub Actions secrets. Run full CI locally; confirm no logs leak PII.
5. **Swap database URL** (30 min): Point `.env` `DATABASE_URL` to Supabase pooled connection. Run `npx prisma migrate deploy`. Verify schema is identical.
6. **Smoke test** (2 hours): Run full test suite against Supabase; drive booking flow in dev; verify TM30 passport encryption/decryption still works; check Vercel Preview.
7. **Fix non-blockers in parallel** (1 day): Swap Prisma logger, schedule iCal sync, wire Redis for notifications (or async fallback), fix remaining English hardcodes.

**Effort:** ~2–3 days for blockers + smoke test; +1 day for non-blockers + full deploy readiness.

---

## Notes

- **P3009 migration stuck state** is external to this repo (lives in `db.prisma.io` account's `_prisma_migrations` table). A **fresh Supabase database is clean** — `prisma migrate deploy` applies `0_init` cleanly.
- **In-memory SSE bus** will silently break on Vercel serverless (multi-instance). For MVP, either (a) deploy to a single-instance Node.js host (Render, Railway, Fly.io) with sticky sessions + in-memory, or (b) add Redis pub/sub (production-ready but adds cost/complexity). Document this constraint in `docs/15_deployment.md`.
- **One Prisma singleton leak:** `src/app/libs/prismadb.ts` and `src/lib/prisma.ts` are both connected to `DATABASE_URL`, duplication creates a footgun. Consolidate to one instance.

---

**Audit completed:** 2026-07-16 · Passes 1–4 (inventory, flows, DB-readiness, secrets/PII)  
**Status:** Ready to unblock and proceed with Phase 2 (Supabase wiring)
