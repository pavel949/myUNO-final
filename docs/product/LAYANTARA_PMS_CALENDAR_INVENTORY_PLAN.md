# LayantaraOS PMS — Calendar, Inventory & Pricing Plan

**Status:** Phase 1 implemented on `feat/layantara-pms-dashboard-calendar-inventory`  
**Principle:** one commercial source of truth, one operational calendar, no duplicate pricing model.

## 1. Product information architecture

The resort PMS should be organised around the operator's mental model rather than database modules:

1. **Today** — arrivals, departures, unpaid stays, issues, operational attention.
2. **Calendar** — what is happening in every villa across time.
3. **Inventory & Pricing** — permanent sellable inventory and commercial defaults.
4. **Operations** — housekeeping, maintenance, inspections, guest requests.
5. **Guests** — guest/stay context and communications.
6. **Reports** — occupancy, ADR, RevPAR, revenue and owner reporting.

Calendar and Inventory & Pricing are connected but intentionally not the same screen.

## 2. Authority model

### 2.1 Permanent inventory truth

`Project -> InventoryCategory -> Unit`

`InventoryCategory` owns the default sellable-class commercial terms:

- category identity/name;
- base nightly rate;
- minimum stay;
- category occupancy facts;
- cancellation-policy inheritance;
- category-scoped RatePlans.

A physical villa is a `Unit` linked to the category. Unit commercial columns remain compatibility mirrors only where the canonical category exists.

### 2.2 Dated operational exceptions

The unit calendar owns exceptions only:

- `BlockedDate`: maintenance, owner hold, OTA import, other blocks;
- `PricingRule`: one-off unit/date nightly price and optional minimum-stay override;
- bookings and stays.

A dated `PricingRule` intentionally outranks the normal category/RatePlan path for its dates. It must not be used as a replacement for permanent seasonal/category setup.

### 2.3 Governance

- Admin/revenue authority can create canonical inventory categories, assign villas to them, and change category base pricing.
- Project operations can manage permitted unit/date blocks and dated pricing overrides under the existing permission model.
- Master inventory and price writes are audited.
- Category price changes and unit-category assignments also update legacy unit mirror fields to prevent old readers from drifting from canonical truth.
- Category keys are stable integration identifiers; display names may evolve later, but keys should not be casually renamed.

## 3. Calendar UX — Phase 1

### Implemented

`/ops/calendar`

- project/context switcher;
- 14 / 21 / 30-day windows;
- previous / next navigation;
- today shortcut;
- sticky villa column and sticky date headers;
- all villas in one horizontal grid;
- category/base-rate/min-stay context in each villa row;
- booking state per night;
- guest surname;
- check-in marker (`IN`);
- check-out marker (`OUT`);
- channel + booking status;
- maintenance/owner/OTA/other blocks;
- dated price override shown directly in the cell;
- conflict visibility when a block and booking overlap;
- direct link from every villa row to the existing unit calendar/override editor;
- direct link to Inventory & Pricing.

### Calendar visual semantics

- In house — primary Andaman treatment.
- Confirmed — outlined booking treatment.
- Pending/requested — warning treatment.
- Blocked/maintenance — error/blocked treatment.
- Price override — explicit THB marker.
- Today — highlighted date column.

### Phase 2 calendar additions

1. Arrival ETA / flight / transfer readiness in arrival cells.
2. Housekeeping status per turnover: dirty -> assigned -> cleaning -> inspection -> ready.
3. Maintenance-readiness blocker marker.
4. Drag-to-create block where permission allows.
5. Click empty date range -> block/price quick action.
6. Booking side drawer with guest, payment, services, issues and stay actions.
7. Category/group filters and search.
8. Compact/comfortable density switch.
9. Week and month views without losing the operational 14/21/30-day strip.
10. Channel-sync health marker at villa level.

## 4. Inventory & Pricing UX — Phase 1

### Implemented

`/ops/inventory`

- same project/context scope as the operations calendar;
- summary counts: categories, active units, uncategorized units, active RatePlans;
- canonical category cards;
- category creation for admins, with project catalog registration in the same transaction;
- stable category keys plus category physical facts;
- category unit counts;
- base rate and minimum stay;
- admin editing of canonical base rate and minimum stay;
- direct villa-to-category assignment/reassignment for admins;
- category assignment updates inherited price/minimum-stay mirrors;
- RatePlan visibility with project/category/unit scope;
- physical inventory table;
- per-unit inherited category/base/minimum-stay visibility;
- block and dated-override counts;
- warning for uncategorized units;
- direct villa-calendar links;
- admin links to unit onboarding and project setup.

### Phase 2 inventory additions

1. Edit/deactivate InventoryCategory beyond current base-rate/minimum-stay controls.
2. Bulk assign/reassign units to categories.
3. Bulk physical-inventory import with validation preview.
4. Category photo/amenity/occupancy inheritance.
5. Dedicated RatePlan editor:
   - BAR;
   - non-refundable;
   - weekly/monthly;
   - derived percentage/fixed adjustments;
   - minimum stay;
   - cancellation policy.
6. Seasonal/date-rule editor with a continuous-calendar validation guard.
7. Bulk rate grid by category and date.
8. Restriction rules: CTA/CTD, min/max LOS, closed-to-arrival/departure.
9. Channel mappings and per-channel sell status.
10. Inventory-health checks before a villa/category can be declared production-ready.

## 5. PMS readiness model — next P0 domain

The next major operational domain should be an explicit readiness state machine:

`occupied -> checkout -> dirty -> assigned -> cleaning -> inspection -> ready -> check-in -> occupied`

Overriding blockers:

- maintenance hold;
- out of service;
- owner hold;
- compliance hold;
- unresolved critical issue.

This should be driven by an `OperationalTask`/equivalent work model so checkout can automatically create cleaning and inspection work rather than relying on manual tickets.

## 6. Recommended delivery sequence

### P0 — now / implemented foundation

- Resort-wide calendar.
- Connected Inventory & Pricing workspace.
- Canonical category creation and villa assignment.
- Canonical category price edit with audit trail.
- Preserve existing unit/date exception editor.

### P0 — next

- Villa readiness state.
- Housekeeping task generation.
- Turnover/inspection workflow.
- Live Resort board on Today.
- Unified Attention Now queue.

### P1

- Full RatePlan/season/restriction editor.
- Calendar booking drawer and fast actions.
- Guest ETA/transfer/readiness integration.
- Worker-specific mobile UX.
- Bulk pricing/inventory tools.

### P2

- Resort map.
- Revenue-management recommendations.
- Forecast/pace overlays.
- Advanced channel-manager controls.

## 7. Acceptance criteria

A hotel manager opening LayantaraOS must be able to answer without navigating multiple modules:

- Which villas are occupied?
- Who arrives and leaves on each date?
- Which dates are blocked and why?
- Are there date-specific rate exceptions?
- What category and base commercial terms does each villa inherit?
- Which villas are uncategorized or commercially misconfigured?
- Where do I change permanent pricing versus a one-off exception?

An administrator must also be able to:

- create a canonical inventory category;
- assign or reassign a villa to a category;
- set category base rate and minimum stay;
- see active RatePlans and dated unit-level exceptions without confusing the two.

The system must make permanent setup and operational exceptions visually distinct and must preserve one pricing authority for every scope/date.
