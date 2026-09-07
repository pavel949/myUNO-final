# Property Flows — Onboard, List, Search, Select, Book

**Date:** 2026-09-07 · **Head:** `ac43205` · **Method:** traced each flow through the running code
— pages, the API routes they call, the services behind them — not through the specs. Every claim
names a file.

**The question asked:** can a property be onboarded and its listing managed, and can another user
search, select and book it, the way they would on Airbnb or Booking.com?

---

## 1. Verdict

**The guest half is complete and connected end to end.** Search → unit → review → book → pay →
trip → cancel/modify/review is a continuous chain of real screens calling real routes, with the
booking's core invariant enforced in the database. A guest arriving from Airbnb finds what they
expect, with two visible absences (a map, and any "similar villas" rail).

**The operator half is complete; the owner half does not exist by design.** A property is onboarded
and its listing managed by **staff, an MC member, or an admin** — through a seven-step mobilization
checklist with legal gates. An **owner cannot touch their own listing**: not the price, not the
calendar, not the photos, not the description. That is not a gap in the build, it is the operating
model (myUNO operates the property; the owner receives statements). It is worth stating plainly
because it is the single largest structural difference from Airbnb, and it is a founder decision
rather than a backlog item.

**The one place the analogy breaks in a way that costs money:** there is no channel **push**. A
direct booking here does not close the villa on Airbnb (`docs/architecture/PRODUCTION_READINESS.md`
§11). iCal import is real; export is real; ARI push is not. Until it exists, every unit also listed
on an OTA carries a double-booking risk that no amount of internal correctness prevents.

---

## 2. Onboard a property — **works, operator-driven**

| Step (doc 07 F-OWN-1) | Where it lives | State |
|---|---|---|
| Create project | `/app/admin/projects` → `POST /api/admin/projects` | Works. Plus Code accepted and decoded server-side against a configured reference |
| Create unit | `create-unit-form.tsx` → `POST /api/admin/units` | Works. **Cannot be born live** — `createUnit` refuses `status: 'live'` outright, so the legal gate cannot be skipped by posting a status |
| 1–7 mobilization checklist | `/app/admin/units/[id]` → `.../mobilization` | Works. `MobilizationChecklistItem`, seven steps, server-enforced order |
| Mandate (`UnitEngagement`) | `.../engagement` | Works. One active engagement per unit, partial unique index |
| Legal audit / permitted use | `.../compliance`, `.../confirm-permitted-use` | Works. Hard gate on go-live |
| Condition survey | `ConditionReport` + media | Works |
| Go-live | `.../status` | Works, with a caveat below |

**Caveat — the go-live gate is looser than doc 07 reads.** `updateUnit` blocks `live` without
`permitted_use_confirmed_at`, but nothing requires the mobilization checklist to be *complete*.
Doc 07 step 7 says "checklist complete **and** permitted-use confirmed". Already logged as **Q43**;
this audit confirms it is still true.

**Missing for a self-serve future:** there is no owner-facing onboarding at all — no "list your
property" entry point, no owner-side draft. If owner self-listing is ever wanted, it is a new
surface, not a permission change: the legal gate has to stay in front of it.

## 3. Manage the listing — **works for staff/MC/admin, absent for owners**

| Capability | Where | Who can |
|---|---|---|
| Calendar blocks + ad-hoc prices | `components/units/AvailabilityPricingPanel.tsx`, mounted on the admin unit page, `/ops/calendar/[unitId]` and `/mc/units/[unitId]` | staff_ops, mc_member, admin (`canWriteAvailabilityAndPricing`) |
| Base rate, min nights, instant-book, policy | `PUT /api/admin/units/[id]` | admin |
| Photos (upload, cover) | `units-client.tsx` → `/api/media/upload` → `/api/admin/units/[id]/media` | admin |
| Description, amenities | content keys + `catalog.amenities`, validated by `assertCatalogKeys` | admin (content layer) |
| Seasonal pricing | `PricingRule` via the same panel | staff_ops, mc_member, admin |
| iCal import/export per unit | `/api/units/[unitId]/ical/*`, admin integrations | admin |

**The owner's surface is read-only.** `src/app/api/owner/` contains exactly four routes: the unit's
contract, the statement list, a statement question, and owner sign-off. Owners also get an owner
stay (`bookOwnerStay`) and tickets. There is no owner write path to any listing attribute, and
`canWriteAvailabilityAndPricing` admits only `staff_ops` and `mc_member`.

**Rule of thumb this establishes:** on this platform "manage listings" means *operator manages
inventory on the owner's behalf, and the owner audits the result*. Everything about the money rails
(statements, NOI caps, fee transparency) is built on that assumption.

## 4. Search — **works, minus the map**

`/search` → `GET /api/search/units`. Present: dates, party size, price range, bedrooms, unit type,
category, area (inclusive of sub-areas), sort (recommended / price / bedrooms / sleeps / rating),
paging, and a map-bounds filter. Availability excludes confirmed and checked-in bookings, live
unexpired holds, and owner/maintenance blocks.

Two real gaps:

- **No map.** The bounds filter is built and tested (`modules/browse/bounds.ts`); nothing draws a
  map or lets a guest pan one. A results-map is a screen composition (doc 06), not a mechanism.
- **The `amenities` filter is documented in the route contract and not implemented** — and nothing
  inherits amenities from project to unit, so a project pool never makes its villas findable by
  "pool". Blocked on a founder ruling (**Q63**, item 3).

**Fixed today:** search, the unit-detail API and category availability all now require a *live
project*. Archiving a project used to leave its villas listed and bookable while their pages 404'd.

## 5. Select — **works**

`/units/[id]` → `GET /api/units/[unitId]` (guest-safe subset; no owner identity, no engagement
economics) + `POST /api/pricing/breakdown`. Gallery with cover, amenities, min nights, instant-book
vs request, cancellation policy, ratings from published stay reviews. Saved villas (`SavedUnit`) and
saved searches (`SavedSearch`) both exist.

Absent: a "similar villas" or "recently viewed" rail. The `page_unit_viewed` event that would feed
one is already tracked.

## 6. Book and pay — **works, cash-first**

`/book/review` → `POST /api/bookings` → instant (hold + payment) or request-to-book (host approval
within a configured window) → `/checkout/[sessionId]` for card, or straight to `/trips` for cash and
bank transfer.

What is genuinely solid here:
- **Double-booking is prevented in the database** — a GiST exclusion constraint plus a per-unit
  advisory lock, with owner blocks checked inside the same transaction.
- **Totals are server-computed**; a client-sent amount is never trusted.
- **The cancellation policy is snapshotted** onto the booking and frozen by trigger.
- **A category booking falls through** to the next free villa rather than losing the sale.
- **Holds expire** and release the dates, retired lazily on the next attempt as well as by the job.

What is not:
- **Cash-first.** The provider seam exists and fails closed; no real card rail is wired
  (`PRODUCTION_READINESS.md` §5). Default provider is Opn/Omise when it is switched on.
- **No `BookingItem`** — one booking is one unit, so multi-villa bookings are not expressible.
- **No persisted `Quote`** to revalidate at checkout.

## 7. After the booking — **works**

`/trips` and `/trips/[id]`: cancel (`/cancel`, policy-driven refund), modify dates (`/modify`,
repriced server-side), passport submission for TM30, in-stay home space, and — since Q62 was written
— **a stay review** (`/api/bookings/[id]/stay-review`, `target_type: 'stay'`, wired from the trip
page). Operator-side: check-in, check-out, condition reports, TM30 queue with SLA escalation.

## 8. Two open questions are stale and should be closed

Found while tracing, both worth a maintainer's five minutes:

- **Q59** says ~40 API routes are built but unwired. The `API_DEBT` set in
  `src/app/reachability.test.ts` is now **two entries** — the two SSE endpoints. The other ~38 have
  been wired since. Only the "adopt the stream or delete it" decision remains.
- **Q62** item 1 says a guest has no way to leave a stay review. `stay-review.service.ts` exists,
  writes `target_type: 'stay'`, and is called from `/trips/[id]`. That item is done.

## 9. What would actually move the needle, in order

| # | Gap | Why it is first |
|---|---|---|
| 1 | **Channel push (ARI)** | Availability is read from OTAs and never written to them. A direct booking does not close the villa on Airbnb — the only gap here that can double-sell a real villa |
| 2 | **A real payment rail** | Cash-first is a deliberate loop-one choice, but every card guest is currently turned away |
| 3 | **Close the go-live gate (Q43)** | A unit can go live with an incomplete mobilization checklist; the legal gate holds but the operational one does not |
| 4 | **Map view on search** | The strongest guest-expectation gap; the filter behind it is already built and tested |
| 5 | **Amenity inheritance + the documented filter** | Needs the Q63 ruling first |
| 6 | **`BookingItem` and a persisted `Quote`** | Before multi-unit sales or a card rail that revalidates at checkout |

Owner self-serve listing management is deliberately **not** on this list. If it should be, that is a
change to the operating model, and it starts in doc 01, not in the code.
