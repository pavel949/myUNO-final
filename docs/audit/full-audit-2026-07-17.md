# Full Product Audit & Remediation · myUNO · 2026-07-17

**Method.** Five parallel deep audits — live end-to-end booking test (against a
real Postgres), data-model consistency, taxonomy/config/content completeness,
architectural debt, and Airbnb-class UX parity — followed by a remediation pass.
This document records the findings and the fixes applied in the same branch.

---

## 1. Verdict

The platform was **~80% built; the missing 20% was connective tissue, not
features**. The recurring pattern: a module was built and unit-tested, but the
wire from it to the surface (route, button, cache, FK) was never connected —
so the behaviour silently didn't happen. The spine, module layout, and specs
are sound. The fixes below reconnect the wires.

---

## 2. Findings (as discovered)

### 2.1 Critical — booking loop & security

| # | Finding | Evidence |
|---|---------|----------|
| C1 | **Request-to-book was a dead end.** `approveBookingRequest`/`declineBookingRequest` existed and were tested but had no API route and no UI — a `requested` booking could never progress. | `src/modules/booking/booking.service.ts:120,149` (zero callers) |
| C2 | **Abandoned holds never expired.** `expireHolds`/`autoDeclineRequests` were wired to no cron; the double-booking guard didn't check `holdExpiresAt`, so one abandoned checkout blocked dates permanently. | `booking.service.ts:365,383`; `vercel.json` |
| C3 | **Booking API leaked `hashedPassword`.** `createBooking`/`getBooking`/cancel/modify included the raw guest identity in responses. | observed in live POST /api/bookings body |
| C4 | **`can()` never denied anyone.** `can()` is async; 30 admin routes called it un-awaited (`!Promise` is always false). Every admin permission check passed regardless of role. | 30 routes under `src/app/api/admin/**` |
| C5 | **Two cron routes accepted `Bearer undefined`** when `CRON_SECRET` was unset (one runs PDPA deletions). | `cron/run-all`, `cron/rollup-metrics` |
| C6 | **Seed crashed on a fresh DB** — duplicate config keys (P2002), a content-translation FK bug, a missing `system` identity, a missing `tsx` dependency. | `config/seed.ts`, `content/seed.ts`, `package.json` |

### 2.2 Data & config integrity

- **`getConfig` never read global-scoped overrides** — so every *global* config
  edit the admin panel made was silently ignored (it wrote a global override
  `getConfig` didn't consult). The founder-editable-config promise was false
  for platform-wide values.
- **Config cache not invalidated on admin edit** — `edit.service` had zero cache
  references; edits lagged up to 60s or never propagated across instances.
- **Content translations never persisted** — `Translation.contentKeyId` is a FK
  to `ContentKey.id` (uuid); `setTranslation`/`t()` used the human key string, so
  every insert failed the FK and every read fell back to the key name. The seed
  produced **0** translations. (After the fix: 1236.)
- **Cascade deletes on money/compliance rows** (documented; see §4 backlog):
  `Booking.unit`/`project` and `ServiceOrder.orderer` are `onDelete: Cascade`,
  against the "never hard-delete money/compliance" rule. Ledger lacks `payoutId`.

### 2.3 Taxonomy / content

- All five `catalog.*` config catalogs were **seeded but never read**; UIs
  hardcoded subsets (ticket form 4/8 categories, unit page 6/12 amenities).
- 48 of 68 config parameters were never read; cancellation policy was
  triple-defined with the hardcoded default (`flexible`) disagreeing with the
  config default (`moderate`).
- Content: **384/540 keys (71%) had no Thai**; default locale was `en` despite
  RU-first positioning; trips list, in-stay space, audience pages, and auth
  emails bypassed the content layer entirely.
- Notifications: 13/39 wired (3 misused); analytics: 9/48 emitted.

### 2.4 UX / Airbnb parity

- Reviews existed in the schema but nowhere in the product; the unit page had no
  date/guest picker, no clickable gallery, showed the raw policy key
  (`flexible`), and had no "ask a question" entry.
- Services marketplace was unreachable from any navigation; most audience
  landing pages were 15-line stubs; the owner page had no CTA.

---

## 3. Fixes applied in this branch

**Booking & security**
- New `POST /api/bookings/[id]/respond` (approve/decline) behind
  `core.can('stays:approve_decline_booking_requests')`, with guest
  notifications; Approve/Decline buttons in the admin bookings UI.
- `expireHolds` + `autoDeclineRequests` wired into `cron/run-all`; availability
  checks (create, search, modify) ignore expired holds.
- Guests may withdraw a `requested` booking.
- Booking responses select only safe identity fields (no `hashedPassword`/PII).
- Both weak cron guards refuse when `CRON_SECRET` is unset.
- All 30 admin `can()` calls awaited.

**Config & content**
- `getConfig` resolves a global override before the seeded default.
- `edit.service` invalidates the config cache on every write; `clearConfigOverride`
  is idempotent.
- `setTranslation`/`t()` resolve the content key to its uuid; translations now
  persist and render.

**Seed & tests**
- Removed duplicate config keys; `seedContent` provisions a system identity;
  added `tsx` + `prisma.seed`. Fresh-DB seed now completes clean.
- `resetDb` truncates all tables generically; vitest runs integration tests
  single-fork with `DATABASE_URL` pinned to the test DB; stale cancel/modify
  tests rewritten onto factories with added PII-leak and expired-hold coverage.

(Further UX, taxonomy-wiring, notification, and data-model-migration work
proceeds in subsequent commits on this branch.)

---

## 4. Backlog (tracked, staged after the loop-critical fixes)

- Migration: `LedgerEntry.payoutId` + relation; `onDelete: Restrict` on
  money/compliance FKs; `RoleScopeType += organization|provider`.
- Rename the snake_case schema region (Provider/Service/ServiceOrder/Review) and
  serialize `/api/service-orders` in camelCase without exposing `take_rate_pct`.
- Wire the five catalogs into their UIs; seed the missing content keys; default
  locale RU; migrate hardcoded-English surfaces onto content keys.
- Wire the dead critical notifications (cancelled, request_*, statement, ticket_*).
- Unit-page UX: date/guest picker, gallery/lightbox, human cancellation terms,
  operator trust block, "ask a question"; services in nav; owner CTA.
- Delete the dead in-memory SSE buses or move to Redis; consolidate the two
  Prisma clients; route ops/tm30/tickets handlers through `core.can()`.

---

*Audit and remediation by Fable. Full per-stream findings are preserved in the
session record.*
