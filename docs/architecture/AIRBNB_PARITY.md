# Airbnb parity — where myUNO stands

**What this document is.** An honest, evidence-backed comparison of myUNO's guest-facing surface against the marketplace features a guest arriving from Airbnb expects to find. Every "present" claim names the file or model that carries it. Every gap says whether it is a missing mechanism (build it) or a deliberate difference (do not build it).

**What it is not.** A roadmap. Closing a gap is a founder decision; several of the gaps below should stay open on purpose.

Last verified: 2026-08-18, against `prisma/schema.prisma` (72 models) and `src/`.

---

## 1. The difference that governs everything else

Airbnb is a **two-sided marketplace** between strangers: anyone lists, anyone books, and most of its machinery exists to make that safe (host verification, guest verification, a resolution centre, payout escrow, cancellation grading, ranking incentives). myUNO is an **operator's system of record** for inventory it manages, in projects it knows, for a clientele it has a relationship with.

So parity is worth having on **discovery, booking, and stay experience** — where the guest's expectations were set elsewhere and disappointing them costs a booking. It is *not* worth having on **marketplace governance**, where copying Airbnb would mean building controls for a problem myUNO does not have.

---

## 2. Present

| Capability | Where it lives |
|---|---|
| Search by dates, party, price, bedrooms, unit type, category | `src/app/api/search/units/route.ts` |
| Availability excludes bookings, live holds, and host blocks | same route; `BlockedDate`; `holdExpiresAt` |
| **Sort** — recommended, price ↑/↓, most bedrooms, sleeps most, top rated | `src/modules/browse/sort.ts` |
| **Paging** — `limit`/`offset`, show-more on the results page | search route; `src/app/search/search-results.tsx` |
| **Map-bounds filter** (API) — `swLat/swLng/neLat/neLng` | `src/modules/browse/bounds.ts` |
| Instant Book vs request | `Unit.instantBook` |
| Server-computed totals; client-sent amounts never trusted | `computePriceBreakdown` (`src/modules/core`) |
| Seasonal / date-range pricing | `PricingRule` |
| Minimum nights | `Unit.minNights` |
| Cancellation policy per unit, snapshotted onto the booking | `Unit.cancellationPolicyKey`; `Booking.cancellationPolicySnapshot` |
| Party composition incl. infants and pets, with pet house rules | `Booking.infants/pets`; `Unit.petsAllowed/maxPets` |
| Holds that expire and release the dates | `Booking.status = pending_payment` + `holdExpiresAt` |
| Date changes and extensions, repriced server-side | `src/modules/booking/booking.service.ts` |
| Double-booking prevented **in the database** | GiST exclusion constraint, migration `…14`; advisory lock per unit |
| Guest reviews the stay; **operator reviews the guest** | `Review`; `src/modules/booking/guest-review.service.ts` |
| Host reply to a review | `Review.reply` |
| Saved villas, in named lists | `SavedUnit`; `src/modules/browse/saved.service.ts` |
| Saved searches, with a matcher for new inventory | `SavedSearch`; `matchesSavedSearch` |
| Messaging between guest and operator | `src/modules/comms` |
| Notifications | `src/modules/comms` (doc 11) — the shared layer, never rebuilt per feature |
| Multiple photos per unit, ordered, with a cover | `UnitMedia`, `MediaAsset` |
| Host-side availability blocking | `BlockedDate` |
| Owner/host earnings reporting | `OwnerStatement`, `EarnedFee` |
| Channel import (iCal) with conflict detection | `src/modules/integrations/ical-*.ts` |

## 3. Gaps — mechanism still missing

These are things a guest would notice, and nothing in the model prevents them.

| Gap | Why it matters | What it needs |
|---|---|---|
| **Map search — the map itself** | The filter is built (§2); nothing draws the map or lets the guest pan it. | A results-map view is a **new screen composition**, so it is doc 06's call, not a mechanism to add quietly. Note `Unit` has **no** coordinates and should not get any — a unit's location *is* its project's, and duplicating it would create two answers to one question. Bounds filtering is project-granular by construction, not by compromise. |
| **Similar villas / recently viewed rails** | The single strongest re-engagement surface on a listing page. | `page_unit_viewed` analytics already exists to feed it. |
| **Review category sub-ratings** (cleanliness, accuracy, location, value…) | An overall star tells an owner nothing actionable. | `Review` carries one `rating`; sub-ratings are additive columns. |
| **Superhost-style badge / response stats** | Trust signal a guest looks for by habit. | Would need a defined standard — a **founder decision**, not a mechanism: what myUNO promises about response time is a service commitment, not a computed stat. |

## 4. Deliberate differences — do not close these

| Airbnb has | myUNO does not | Why |
|---|---|---|
| Anyone can list | Inventory is onboarded through mobilization and a permitted-use gate | Licensing is a hard legal gate (CLAUDE.md, doc 07). An open listing flow would route around it. |
| Multi-currency charging | THB only, satang integers | Operating FX is licensed activity (AMLO). Display conversion is possible; charging in another currency is not ours to do. |
| Escrowed guest funds and payouts | Cash-first with a provider seam; deposits are pre-authorizations only | Holding guest funds without a licence is a Bank of Thailand matter (doc 10, Q6). |
| Resolution centre / claims arbitration | Tickets and the ombudsman page | myUNO operates the property; it is a party to the dispute, not a neutral platform. Copying the neutral-arbiter UI would misrepresent who is answering. |
| Ranking that hosts compete in | One sort the guest chooses | There is no host competition to arbitrate. A ranking algorithm here would be the operator quietly preferring its own units over an owner's — exactly the conflict owner statements exist to disprove. |
| Guest identity verification as a platform feature | Passport capture under PDPA, for TM30 | Same data, a different purpose: immigration compliance, not marketplace trust scoring. It must not be repurposed into a badge. |

## 5. Standing questions this raises

- **Q38** — what a saved-search alert *does* (immediate, digest, or nothing until they return). The matcher is built; the cadence is a tone decision.
- A badge standard, if the founder wants one (§3, row 4).

---

*Maintained alongside `PLATFORM_MATURITY.md`. When a gap in §3 closes, move the row to §2 with its file path.*
