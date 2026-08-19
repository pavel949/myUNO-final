# What works, for whom — a reachability audit

**What this is.** Every flow in doc 07, every role in doc 03, and every model in doc 02, checked against what the running application can actually reach. Method as before: a function that exists but nothing calls is recorded as **unreachable, not as built**. Tests passing is not evidence a user can get there.

Verified 2026-08-19 against `main` at `92aeeb1`.

---

## 1. The headline

**The booking state machine is not connected to the application.**

`src/modules/booking/booking.service.ts` defines the transitions doc 02 §3.1 specifies — `confirmBooking`, `checkInBooking`, `checkOutBooking`, `completeBooking`, `markNoShow`. Each is tested. **None has a single caller anywhere in `src/app`.**

The routes do the work themselves. `POST /api/bookings/[id]/checkin` calls `prisma.booking.update(...)` inline, then `createTm30Filing` and `createConditionReport` directly. Four route files set `booking.status` by hand, and **31 of 144 route files write to Prisma directly**.

Two consequences, and the second is the serious one:

1. **The guards in the state machine never run in production.** Whatever the service validates about a transition, the route doesn't.
2. **There are two implementations of every stay transition, and only one is tested.** The tested one is the one nobody runs. This is the drift Q37 already warns about, at a larger scale — and it means green tests are weaker evidence than they look for anything on the stay path.

This also violates CLAUDE.md's module rule: modules connect through one `index.ts` interface, and business logic lives in `src/modules/*`, not in route handlers.

**I contributed to this.** `changeBookingDates`, which I wrote earlier in this session for date changes, has **no caller** — `POST /api/bookings/[id]/modify` does its own conflict check with `prisma.booking.findFirst` rather than calling it. I built the same unreachable pattern I had just finished criticising in the onboarding audit.

## 2. Reachability by role

| Role | Landing | Core surfaces | Verdict |
|---|---|---|---|
| **Guest (booking)** | `/search`, `/units/[id]`, `/trips` | search, unit detail, checkout, trips, trip detail | **Works** |
| **Guest (in stay)** | `/bookings/[id]/home-space` | home space, handbook, passports, extension | **Works** |
| **Owner** | `/owner` | portfolio, `/owner/statements/[id]` | **Partial** — no per-unit dashboard (doc 08 S8) |
| **Resident** | — | none of its own | **Absent** — a resident has no surface at all |
| **Buyer** | `/buyers` (public marketing) | none authenticated | **Absent** — buyer signals are staff-side only |
| **Provider** | `/provider` | apply, services | **Partial** — no remittances view (doc 08 §5) |
| **MC member** | `/mc` | one page | **Thin** — doc 07 F-MC-2 expects scoped boards |
| **Juristic member** | — | none | **Absent** — can't post announcements (doc 09 §3) |
| **Staff (ops)** | `/ops`, `/ops/tm30` | arrivals, TM30 | **Partial** — doc 08 §5 lists seven ops boards; two exist |
| **Admin** | `/app/admin` | 15 pages | **Mostly** — see §4 |
| **Any role** | — | `/messages`, `/tickets`, `/services` | **Works** |

**Nobody has an account surface.** There is no `/account` page anywhere: no profile edit, no locale preference, no password change, no notification preferences. `NotificationPreference` exists in the schema and doc 11 specifies per-type mutes and quiet hours; nothing can set them. For a platform under PDPA, notification consent with no way to withdraw it is the gap that matters most here.

**There is no adaptive landing.** Doc 08 §5 specifies `/app` routing a person to the surface their role implies. It does not exist, so where a user lands depends on which link they happened to follow.

## 3. Flows

Reachable end to end: **F-AUTH-1/2** (register, login, reset), **F-GUEST-1..10** (search through review, extension, cancellation), **F-SVC-1..4** (marketplace, orders, quotes), **F-PROV-1/2** (apply, vetting, services), **F-OPS-1/2** (check-in, TM30), **F-FIN-1** (statements, admin-side), **F-OWN-1** (onboarding — wired in this PR).

Not reachable:

- ~~**F-AUTH-4 (claim account)**~~ — **this was wrong, and the correction matters.** The claim flow was complete all along: `/auth/claim`, `GET /api/auth/claim/[token]`, `POST /api/auth/claim`, and `people.claimIdentity` behind them. What I actually found was an *unused second implementation*, `auth.claimAccount`, which has no caller — the same duplication §1 describes, not a missing flow. I recorded a working flow as broken because I searched for one function name.
  The real gap was at the other end and is now fixed: **nothing could put a person into `invited` status**, so the flow began nowhere. `people.inviteIdentity` plus `POST /api/admin/people/invite` and an invite panel on People & Roles close F-OWN-1 step 7. Two things came with it — issuing a new claim link now consumes every earlier one (a resend used to leave the old link live in a forwarded email), and an address that already has a working account is reported as such rather than being downgraded to `invited`.
- ~~**F-OPS-3 (record a cost)**~~ — **this was overstated and is corrected here.** `POST /api/ledger/record-cost` did exist; what was missing was a *screen* to reach it, so an expense could only be entered by hand-crafting a request. Built at `/ops/costs`, linked from the ops board. The functions named in the original claim — `recordBookingRevenue`, `recordRefundOut` — genuinely have no route, but they are **automatic** entries that belong on the payment path, not behind a form, so their having no route is correct rather than a gap. (Revenue is in fact written, by `finance.service.ts`; `ledger.service.ts:recordBookingRevenue` is an unused second implementation of it — a smaller instance of the same duplication this audit's §1 describes.)
- **F-OPS-5 / F-OWN-4** — no surface.
- **F-FIN-2 (payouts and reconciliation)** — `recordOwnerPayout`, `recordProviderRemittance`, `markPayoutReconciled` have no callers; the `/app/admin/payouts` page exists but is not in the admin navigation.
- **F-DIS-1/2 (damage claims, disputes)** — `fileDepositClaim`, `approveClaim`, `rejectClaim` have no callers. Deposits can be scheduled but a claim cannot be filed.
- **F-MC-2** — beyond the single `/mc` page.
- ~~**Announcements**~~ — **built** (`/app/admin/announcements`, `POST /api/announcements` + publish/withdraw). Two scoping bugs surfaced underneath the missing composer and are fixed with it: the home space rendered *every* published announcement regardless of `audience`, so an owners-only notice appeared on a guest's screen and an expired one never went away; and publishing to `guests_in_stay` notified **nobody**, because the audience resolved through a `guest` role row that booking has never written — the publish succeeded and reached zero people. In-stay membership now derives from the booking. `postedAs` is resolved server-side from the poster's role and is not accepted from the request: it is the signature on a building-wide broadcast, and a client-chosen value would let staff speak as the juristic person.

## 4. Admin panel

Doc 08 §6 specifies twelve sections. **People & Roles is now built** (`/app/admin/people`) — search, grant, revoke, block, with the roles a person already holds shown before you add another. **The audit log is now readable** (`/app/admin/audit`) — filter by action, area, record, person or date range, page through it, export the filtered view as CSV. The export is itself audited (`audit:export`); browsing is not, because an entry per page view buries the actions that matter under the act of looking at them. **Announcements is now built** (`/app/admin/announcements`) — draft, then publish as a separate deliberate act, with withdraw. Still missing: **Tickets**, **Compliance**.

~~**Finance is built but invisible.**~~ **Fixed:** ledger, statements and payouts are now in the sidebar. Reconciliation still sits outside the admin group at `/admin/finance/reconciliation`.

`admin-nav-is-reachable.test.ts` now fails the build if an admin page directory exists with nothing linking to it — the "built but invisible" class of defect, caught structurally rather than noticed later.

**Found while building the export, not fixed here (out of scope, recorded so it is not lost):** the content CSV round-trip at `/api/admin/content/export` → `importFromCSV` parses with a bare `split(',')`, so **any translation containing a comma is corrupted on import** — which is most sentences. It also has no formula-injection guard. The audit export uses the new shared `src/lib/csv.ts` (RFC 4180 quoting plus a guard against cells a spreadsheet would execute); the content export should be moved onto it together with a real parser on the import side.

## 5. Data model

75 models. Five are never read or written outside tests and seeds:

| Model | Consequence |
|---|---|
| `ProjectMedia` | Project galleries are specified (doc 08 §4) and cannot be populated |
| `ServiceMedia` | A service cannot have photos |
| `TicketMedia` | A ticket cannot carry a photo, which doc 09 §2 assumes for maintenance |
| `ProviderProject` | A provider cannot be scoped to projects — doc 02 §4.1's service areas |
| `AuthAccount` | Expected: OAuth linkage, unused while auth is credentials-only |

Everything else in doc 02 is exercised. The spine — project → unit → identity → roles — is sound, and this PR added areas, ownership periods, saved units and searches on top of it.

## 6. What to build, in the order I would do it

1. ~~**Reconnect the booking state machine.**~~ **Done** — check-in, check-out and the date change now run the tested transitions. `state-machine-is-wired.test.ts` keeps them there.
2. ~~**`/account`**~~ **Done** — profile, language, password, and notification preferences with the two obligation-carrying types fixed on.
3. ~~**Record a cost (F-OPS-3)**~~ **Done** — `/ops/costs`. The gap was the screen, not the route; see §3.
4. ~~**People & Roles admin**~~ **Done** — `/app/admin/people`.
5. ~~**Audit log viewer**~~ **Done** — `/app/admin/audit`, with a recorded CSV export for doc 12 §6's monthly compliance report. ~~Finance in the nav~~ done.
6. ~~**Announcements composer**~~ **Done** — admin-side. MC and juristic members can already post through the same route (`can()` scopes it by project); what they lack is a screen of their own, which belongs with item 7.
   ~~Then **claim account (F-AUTH-4)**~~ **Done** — see §3: the claim flow was already complete and my audit was wrong; what was missing was the invitation that starts it. Next: **damage claims (F-DIS-1)**.
7. **Resident and juristic surfaces**, **MC boards**, **the remaining five ops boards**, **provider remittances**.
8. **T-043 launch checklist** — the only build-plan task with nothing committed against it.

Items 1–5 are what stood between this and an operator being able to run a residence without a database client. They are done.

---

*Companion to `ONBOARDING_FLOW_AUDIT.md` and `PLATFORM_MATURITY.md`. Reachability findings only: a service with no caller is recorded as unreachable regardless of how well it is tested.*
