# Canonical rate-plan migration status

Status: active for guest quoting and booking, with legacy seasonal configuration retained only as an explicit compatibility layer.

## Current source-of-truth order

1. `InventoryCategory` owns the category base nightly rate and default minimum stay.
2. The applicable active `BAR` `RatePlan` (unit → category → project) owns plan-level minimum stay and adjustment.
3. A dated unit `PricingRule` is the highest-priority explicit nightly-price/min-stay override.
4. Legacy `pricing.season.calendar` and `pricing.category_rates` may still supply seasonal/monthly amounts while those concepts do not yet have first-class canonical tables.
5. Project/unit pricing configuration supplies fees, taxes and LOS/early-bird rules.
6. `computePriceBreakdown` is the shared calculation seam for dated search, guest quote and booking creation.
7. `Booking.priceBreakdown` and `Booking.totalThb` persist the accepted server-side calculation; client-sent totals are never authoritative.

The legacy seasonal/monthly layer must not be removed until an equivalent canonical seasonal-rate model exists and its data is migrated. It is a compatibility input to the one calculator, not a second guest pricing engine.

## Required invariants

1. Search, quote and booking call the same calculator for identical unit/dates/party inputs.
2. A live unit has a canonical `InventoryCategory`.
3. Base rate and minimum stay come from the category unless a higher-priority BAR plan or dated rule overrides them.
4. Availability is determined by bookings, active payment holds and `BlockedDate`; pricing never makes unavailable nights bookable.
5. Booking creation recomputes price server-side immediately before claiming dates.
6. Money is stored in satang and converted to baht only at display/input boundaries.
7. Admin UI must show inheritance and overrides instead of requiring duplicate values.
8. Owners are read-only for commercial pricing unless an explicit delegated pricing permission is introduced.

## Remaining migration

Introduce first-class seasonal rate periods/derived rate-plan rules before deleting `pricing.season.calendar` and `pricing.category_rates`. The migration must preserve monthly rates, overlapping-season precedence, LOS/early-bird behavior, taxes/fees and historical booking snapshots.

OTA policy: iCal/manual synchronization is availability-import only and carries oversell risk. Operators must close external inventory manually after direct bookings until a channel mapping reports an implemented and verified `ari_push` capability.
