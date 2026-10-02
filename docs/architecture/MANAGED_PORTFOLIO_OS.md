# myUNO Managed Portfolio OS — canonical operating contract

Status: shared read-only operational calendar implemented at /ops/calendar/board. Legacy /mc/calendar and /mc/portfolio entry points redirect into this projection; canonical unit-level availability/pricing screens remain the only write path. This is not a claim that every PMS overlay or production cutover gate is complete.

## The operating model

The management company (Organization) owns an operational mandate on a Unit through an active UnitEngagement. A Project is a physical complex/resort; InventoryCategory groups comparable inventory; Unit is a real unit. Multiple Project scopes belong to a single internal portfolio. CommercialOffering, RatePlan and PricingRule remain attached to the existing physical and commercial records. Do not duplicate a unit for sale, monthly rent and short stays.

- Portfolio director: authorized overview across resorts and condominiums.
- Resort manager: assigned resort project(s) and their units/categories.
- Condominium manager: assigned managed units across multiple condo projects, not every apartment in the building.
- Reception, housekeeping and maintenance: scoped tasks and least-privilege record access.
- Owner: own unit(s) only. External management company: own active engagements only.
- Finance: approved scope and ledger read/write permissions independent of operations.
- Admin: configuration, invites, legal activation and exceptional changes, not a prerequisite for day-to-day management.

Current role model: mc_member requires an active RoleAssignment for the same project+organization as an active via_management_company UnitEngagement; staff_ops/onsite_host use project scope. A project role alone must never reveal unmanaged condominium units. Unit-specific access must be checked by the server on EVERY write, not only hidden in the UI. Organization membership is not a blanket authorization for all units.

## Canonical calendar contract

The calendar is **a projection**, not a new occupancy database.

| Subject | Write owner | Read source | Treatment |
| --- | --- | --- | --- |
| Physical inventory | Project → InventoryCategory → Unit | canonical property records | Filter by actual mandate |
| Sold nights | Booking | booking lifecycle | Confirmed and checked-in are blocking; historical checked-out/completed are occupancy history |
| Payment holds | Booking | live holdExpiresAt | Only non-expired pending_payment blocks sales |
| Requests | Booking | requested status | Show as unconfirmed, never count as occupied |
| Unavailable nights | BlockedDate | all current block reasons | Manual, owner and OTA imports block availability |
| Pricing override | PricingRule | existing pricing resolution | Display informational override; quote engine decides final price |
| Base price | InventoryCategory, Unit fallback | canonical price model | Indicative only, not a final quote |
| Housekeeping | stay/operations task records | operational task owner | Overlay on stay calendar, not booking |
| Maintenance | Ticket + BlockedDate | respective owners | Ticket alone does not sell-block; create explicit block for unavailable dates |
| Channel status | channel adapter / sync logs | integration records | iCal import cannot be treated as verified ARI push |

The authoritative sellability predicate is the existing booking/availability service. Never implement a second writable calendar table or make a UI drag operation change a pixel without successfully committing the booking/block mutation. Use [startDate, endDate), i.e. checkout night is free; use project calendar date/timezone, avoid browser-local date shifts. All mutations must check the canonical no-overlap constraint and return conflict detail. Historical occupancy is a different metric from forward availability. Do not count requests, open tickets, or expired payment holds as occupied.

## Required end-to-end manager screens

1. Portfolio home: all authorized properties; occupied/available nights; arrivals/departures; upcoming requests; payment exceptions; tasks; sync failures; financial summaries separated by currency and tax basis. Allow resort and condominium scopes and an all-managed view.
2. Unified calendar: 7/14/30-day horizontal unit grid, project/category/unit hierarchy, search and sticky headers, booking/hold/owner/maintenance/OTA block legends, conflicts, day rates, navigation by date and project. Unit click opens existing canonical unit calendar; booking click opens reservation detail. Mobile defaults to compact agenda/day view rather than unreadable 30-column grid.
3. Reservations: request → confirmed → pre-arrival → checked-in → checked-out → completed, one Booking ID. Arrival/departure and payment alerts route to the same record. Do not duplicate reservation and stay operations mutations.
4. Rates and restrictions: category master rate plan, unit override, daily rule, minimum stay, seasonal rates, promotion/channel mapping; show effective rate source and preview with the canonical quote engine.
5. Housekeeping and maintenance: task assignments, due/started/completed, inspection and photos, readiness; maintenance block only when needed; task event overlays on calendar.
6. Team: organization, project and optionally unit scope; explicit permission matrix and actor audit. Owner and external manager onboarding does not grant admin.
7. Reconciliation: occupancy, paid and unpaid, booking-vs-block conflicts, imports-vs-direct bookings, OTA sync lag, unmapped units, stale rates, mandate expiry.

## Current implementation status (2026-10-02)

- /ops/calendar and both MC calendar entry points converge on the same 7/14/30-day projection over canonical Booking and BlockedDate rows.
- MC mode can span every authorized project while still deriving each visible unit from a matching active RoleAssignment + via-management-company UnitEngagement; project switching does not widen unit authority.
- Desktop uses the sticky horizontal project/category/unit grid; mobile defaults to a day agenda instead of rendering a 30-column grid.
- Unit calendar already has AvailabilityPricingPanel, iCal conflict and integration status and remains the mutation path; the shared portfolio view stays read-only.
- Availability continues to treat BlockedDate, confirmed/checked-in Booking and unexpired pending_payment holds as the sellability inputs; requests and historical occupancy remain visually distinct.
- Remaining product work is narrower: housekeeping/readiness overlays, effective-rate parity with the canonical quote engine, channel-sync health/ARI evidence, and the full multi-role production smoke matrix.
- RoleAssignment is checked again at read time, paired to active UnitEngagement, protecting against stale session scope.

## Delivery gates

A. Complete: shared cross-project read-only occupancy grid, canonical booking/block projection and links into existing unit editor; no second calendar store.
B. Complete for calendar reads: staff/MC scope guards and cross-project MC projection with per-unit engagement enforcement.
C. Complete for calendar shell: one shared /mc + /ops data contract, reservation drilldowns for staff, category/unit filters, 7/14/30 ranges, mobile day agenda and periodic/event-cursor refresh. Legacy MC calendar surfaces now redirect to it.
D. Task/readiness overlays and writes through existing stay/Ticket/BlockedDate workflows; audit and conflict resolution.
E. Pricing effective-rate parity and channel-sync health; test across all tariffs, currencies, promotions and unit/category rates.
F. QA with two disjoint managers, owner, reception and admin, including cross-scope denial, expired hold, end-exclusive checkout, overnight timezone, concurrent writes, OTA conflict, refund and check-in/out. Production activation only after migration/reconciliation and live smoke tests.

Do not promote an interface to production on the strength of a build alone; a green build does not prove RLS, mandate accuracy, historical booking migration or OTA sync.
