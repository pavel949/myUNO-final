# Canonical rate-plan migration decision

Status: deferred for guest quoting; enabled for onboarding configuration.

The canonical `InventoryCategory` and `RatePlan` records are the future inventory and pricing model. They can now be maintained in the unified Add Property workspace. They are deliberately **not** consulted by search, availability, checkout, or booking confirmation yet.

Until one end-to-end migration owns seasonal selection, occupancy rules, discounts, taxes, quote persistence, and price revalidation, guest pricing remains on the existing `Unit.baseNightlyThb` / project pricing configuration path. The admin UI labels canonical plans as configuration-only, and the readiness report emits a warning when plans exist.

Migration acceptance criteria:

1. Search and booking resolve the same eligible rate plan for identical inputs.
2. The selected plan and pricing inputs are persisted with the quote/booking.
3. Checkout revalidates plan availability and price atomically.
4. Existing unit/category pricing has a reversible data migration.
5. Integration tests cover seasonal boundaries, occupancy, discounts, cancellation terms, and retries.

OTA policy: iCal/manual synchronization is availability-import only and carries oversell risk. Operators must close external inventory manually after direct bookings until a channel mapping reports an implemented and verified `ari_push` capability.
