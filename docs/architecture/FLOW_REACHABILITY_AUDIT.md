# What works, for whom — a reachability audit

**What this is.** Every flow in doc 07, every role in doc 03, and every model in doc 02, checked against what the running application can actually reach. Method as before: a function that exists but nothing calls is recorded as **unreachable, not as built**. Tests passing is not evidence a user can get there.

Verified 2026-08-19 against `main` at `92aeeb1`. **Refreshed 2026-09-04** on branch `cursor/design-md-login-polish-c326` (PMS parity pass) — §1 headline corrected, §2 role table updated, §3 flows/notifications/payments brought current. Structural tests (`state-machine-is-wired.test.ts`, `reachability.test.ts`) are the live evidence; this document is commentary on them.

---

## 1. The headline

~~**The booking state machine is not connected to the application.**~~ **Corrected (2026-09-04): the stay state machine is wired.** `state-machine-is-wired.test.ts` fails the build if any route sets `checked_in` / `checked_out` / `completed` / `no_show` by hand, and requires `checkInBooking`, `checkOutBooking`, and `changeBookingDates` to be called from API routes. `POST /api/bookings/[id]/modify` delegates to `changeBookingDates` (server-computed repricing, advisory lock, `BlockedDate` check).

**What remains true from the original audit:** many routes still write to Prisma directly for non-transition work — that is not automatically wrong, but it is why Q37's duplication warning stays relevant. New transitions must go through `src/modules/booking/index.ts`, not inline `prisma.booking.update`.

**Historical note (Aug 2026):** the original §1 was accurate when written; the reconnect landed in item 6 below before this refresh.

## 2. Reachability by role

| Role | Landing | Core surfaces | Verdict |
|---|---|---|---|
| **Guest (booking)** | `/search`, `/units/[id]`, `/trips` | search, unit detail, checkout, trips, trip detail | **Works** |
| **Guest (in stay)** | `/bookings/[id]/home-space` | home space, handbook, passports, extension | **Works** |
| **Owner** | `/owner` or `/owner/units/[id]` | portfolio, unit detail, statements, raise ticket / book service (F-OWN-4) | **Mostly** — single-unit adaptive landing (doc 06 S7) redirects to unit dashboard; F-OWN-4 quick actions work |
| **Resident** | `/residence` | announcements, handbook, services, tickets | **Works** — built; F-RES |
| **Buyer** | `/buyers` (public marketing) | none authenticated | **Absent** — buyer signals are staff-side only (Q1) |
| **Provider** | `/provider` | apply, services, `/provider/remittances` (F-PROV-4) | **Works** — remittance report + payout history in provider nav |
| **MC member** | `/mc` | overview, bookings, `/mc/requests` (F-OPS-5), tickets, calendar, fee reports (period picker + CSV export), announcements | **Mostly** — tabbed F-MC-2 boards on `/mc`; dedicated sub-routes for TM30, mobilization, requests, costs |
| **Juristic member** | `/juristic` | announcements, project tickets | **Works** — built; posts via `/announcements` |
| **Staff (ops)** | `/ops` | arrivals, departures, `/ops/requests`, `/ops/tm30`, `/ops/costs`, `/ops/claims`, `/ops/mobilization`, `/ops/calendar`, unit calendar | **Mostly** — F-OPS-4 calendar/pricing UI at `/ops/calendar/[unitId]` + MC `/mc/units/[unitId]` |
| **Admin** | `/app/admin` | 15+ pages incl. payouts + reconciliation link | **Mostly** — see §4 |
| **Any role** | — | `/messages`, `/tickets`, `/services` | **Works** |

~~**Nobody has an account surface.**~~ **Built** — `/account` carries profile, locale, password and notification preferences, with the two obligation-carrying notification types fixed on. For a platform under the PDPA, consent nobody could withdraw was the sharpest gap here.

**Everything anyone signed in has is now in one menu**: their stays, conversations, requests and service orders, then the surfaces their roles give them, then their account. `/services/orders` in particular did not exist — order *detail* did, so an order was findable only if you still had the link.

~~**There is no adaptive landing.**~~ **Built** — `/app` routes a person by the policy in `core/landing.ts`: a stay under way wins over everything (somebody in a bed tonight needs the door code, not a portfolio), then admin, staff, management company, juristic person, provider, owner, resident. A buyer goes to the search, because doc 07 F-BUY defers the buyer surfaces to phase two (Q1) and an empty page would be a worse answer than the search they arrived from. The navbar reads the same policy, so the menu and the landing cannot disagree.

## 3. Flows

Reachable end to end: **F-AUTH-1/2** (register, login, reset), **F-GUEST-1..10** (search through review, extension, cancellation, modification), **F-SVC-1..4** (marketplace, orders, quotes), **F-PROV-1..4** (apply, vetting, services, remittances), **F-OPS-1..6** (board, TM30, costs, claims, request inbox, cash payment), **F-OWN-1/3/4** (onboarding, statements, ticket/service for own unit), **F-FIN-1/2** (statements; payouts + reconciliation board), **F-DIS-1** (damage claims + deposit preauth on confirm).

Not reachable / partial:

- ~~**F-AUTH-4 (claim account)**~~ — **this was wrong, and the correction matters.** The claim flow was complete all along: `/auth/claim`, `GET /api/auth/claim/[token]`, `POST /api/auth/claim`, and `people.claimIdentity` behind them. What I actually found was an *unused second implementation*, `auth.claimAccount`, which has no caller — the same duplication §1 describes, not a missing flow. I recorded a working flow as broken because I searched for one function name.
  The real gap was at the other end and is now fixed: **nothing could put a person into `invited` status**, so the flow began nowhere. `people.inviteIdentity` plus `POST /api/admin/people/invite` and an invite panel on People & Roles close F-OWN-1 step 7. Two things came with it — issuing a new claim link now consumes every earlier one (a resend used to leave the old link live in a forwarded email), and an address that already has a working account is reported as such rather than being downgraded to `invited`.
- ~~**F-OPS-3 (record a cost)**~~ — **this was overstated and is corrected here.** `POST /api/ledger/record-cost` did exist; what was missing was a *screen* to reach it, so an expense could only be entered by hand-crafting a request. Built at `/ops/costs`, linked from the ops board. The functions named in the original claim — `recordBookingRevenue`, `recordRefundOut` — genuinely have no route, but they are **automatic** entries that belong on the payment path, not behind a form, so their having no route is correct rather than a gap. (Revenue is in fact written, by `finance.service.ts`; `ledger.service.ts:recordBookingRevenue` is an unused second implementation of it — a smaller instance of the same duplication this audit's §1 describes.)
- ~~**F-OPS-5 / F-OWN-4**~~ — **built (2026-09-04 correction).** F-OPS-5: `/ops/requests` and `/mc/requests` — party, dates, breakdown, approve/decline with reason keys (`respond` API + `getOpsBookingRequests` / MC inbox). F-OWN-4: owner dashboard and unit detail link to `/tickets/new?unitId=…` and `/services?projectId=…&unitId=…`.
- ~~**F-FIN-2 (payouts and reconciliation)**~~ — **built:** `/app/admin/payouts` (in admin nav) records owner and provider payouts; `/admin/finance/reconciliation` board linked from payouts; provider portal `/provider/remittances` (F-PROV-4).
- ~~**F-DIS-1 deposit rail (Q46)**~~ — **wired (2026-09-04):** `ensureDepositPreauthOnStayConfirmed` on all confirmation paths; `voidDepositPreauthIfClean` on checkout. Claims UI at `/ops/claims` + `/app/admin/claims` unchanged.
- ~~**F-DIS-2 (disputes)**~~ — **built (Q52):** `POST /api/disputes`, `/app/admin/disputes` in admin nav, guest raise from trips.
- **F-MC-2** — fee report now has period picker + CSV export via `GET /api/mc/fee-report`; deeper boards remain on `/mc` tabs.
- ~~**Announcements**~~ — **built** (`/app/admin/announcements`, `POST /api/announcements` + publish/withdraw). Two scoping bugs surfaced underneath the missing composer and are fixed with it: the home space rendered *every* published announcement regardless of `audience`, so an owners-only notice appeared on a guest's screen and an expired one never went away; and publishing to `guests_in_stay` notified **nobody**, because the audience resolved through a `guest` role row that booking has never written — the publish succeeded and reached zero people. In-stay membership now derives from the booking. `postedAs` is resolved server-side from the poster's role and is not accepted from the request: it is the signature on a building-wide broadcast, and a client-chosen value would let staff speak as the juristic person.

### 3.1 Notification catalog (doc 11) — PMS parity pass 2026-09-04

Stay notification fan-out now wired end-to-end for the booking lifecycle slices below (content keys EN/RU/TH in `seed.ts`; integration tests per slice):

| ID | Type | Trigger | Status |
|---|---|---|---|
| N-03 | `stay_new_booking_ops` | Booking confirmed → ops/MC | ✅ |
| N-09 | `stay_cancelled` | Cancel → guest + owner/ops | ✅ |
| N-11 | `stay_modified_ops` | Date change → guest + ops/MC/owner | ✅ |
| N-33/34 | `stay_request_placed` / `stay_request_received` | Request-to-book created | ✅ |
| N-34 reminder | `stay_request_reminder` | Half-SLA cron if still unanswered | ✅ |
| N-08 | `stay_verification_failed` | Passport deadline job | ✅ (pre-existing) |
| N-10 | `finance_refund_failed` | Provider refund void + admin alert | ✅ |
| N-12 | `stay_checkout_reminder` | Departure day 08:00 cron → guest | ✅ |
| N-07b | `stay_checkin_instructions` | Verification complete, T-24h cron → guest | ✅ |
| N-14 | `stay_post_stay` | Check-out + 7d re-engage cron → guest | ✅ |
| N-26 reminder | `order.new` (half-SLA body) | Unanswered service order → provider | ✅ |
| N-27 | `order_review_prompt` | Fulfilled + 12h cron → orderer | ✅ |

Payment seam (doc 10, excluding bank-channel per scope): mock checkout default; Opn `createCheckout` + `verifyAndConfirm` + `POST /api/webhooks/opn` when `PAYMENT_PROVIDER=opn`. Cash rail (F-OPS-6) unchanged.

**Stay + service order notification catalog complete (N-02…N-14, N-26/27 wired).**

**API debt reduction (2026-09 PMS pass):** … content CSV export/import/namespace, compliance checklists board, unit asset status, MC fee report API — **28+ routes** removed from `API_DEBT` since the audit refresh.

## 4. Admin panel

Doc 08 §6 specifies twelve sections. **People & Roles is now built** (`/app/admin/people`) — search, grant, revoke, block, with the roles a person already holds shown before you add another. **The audit log is now readable** (`/app/admin/audit`) — filter by action, area, record, person or date range, page through it, export the filtered view as CSV. The export is itself audited (`audit:export`); browsing is not, because an entry per page view buries the actions that matter under the act of looking at them. **Announcements is now built** (`/app/admin/announcements`) — draft, then publish as a separate deliberate act, with withdraw. **Tickets** (`/app/admin/tickets`) — cross-project SLA board with acknowledge/resolve actions. **Compliance** (`/app/admin/compliance`) — TM30 ledger, unit records needing attention, retention posture. **Disputes** (`/app/admin/disputes`) — F-DIS-2 arbiter queue.

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
   ~~Then **claim account (F-AUTH-4)**~~ **Done** — see §3: the claim flow was already complete and my audit was wrong; what was missing was the invitation that starts it. ~~Next: **damage claims (F-DIS-1)**~~ **Done** — with Q46 raised, because the deposit rail underneath it has never been connected to a booking and doc 07 and the code disagree about what the 48 hours are for.
7. ~~**Resident and juristic surfaces**~~ **Done** — `/residence` and `/juristic`, plus `/announcements`. Still open: **F-OPS-4** (pricing/calendar upkeep UI), **F-MC-2** deeper boards, **F-DIS-2** dispute surface.
8. ~~**PMS notification + payment parity (2026-09)**~~ **Done** — N-03/09/11/33/34/N-10 fan-out; Opn checkout + webhook; Q46 deposit preauth on confirm.
9. **T-043 launch checklist** — track in `T-043_LAUNCH_CHECKLIST.md`.

Items 1–5 are what stood between this and an operator being able to run a residence without a database client. They are done.

---

*Companion to `ONBOARDING_FLOW_AUDIT.md` and `PLATFORM_MATURITY.md`. Reachability findings only: a service with no caller is recorded as unreachable regardless of how well it is tested.*
