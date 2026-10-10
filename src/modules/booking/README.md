# Booking Module

Owns booking lifecycle, availability, pricing, hold logic.

## Inventory-selection contract (CO07, 2026-10-09)

- A public booking selects either one exact `unitId` or one canonical category. Mixed selectors are invalid. A category request requires its current signed quote and accepted total.
- `createBookingAttempt` remains the only public booking writer. Its server-only `inventoryCategoryId` input is populated by the validated category API, and is checked against the physical unit's live canonical category/project inside the existing inventory transaction.
- The writer records controlled, versioned selection evidence in the existing `priceBreakdown` snapshot. This is canonical transaction consent metadata, not new inventory or a second authority store:
  - exact: `inventory_selection = { version: 1, kind: 'unit', unitId }`;
  - category: `inventory_selection = { version: 1, kind: 'category', inventoryCategoryId }`, plus the existing matching `inventory_category_id` field.
- Arbitrary client/supplied price snapshots cannot issue this evidence. For a guest stay, the writer always reconstructs authoritative pricing and the selection snapshot from validated server inputs.
- Request approval may substitute a unit only for a valid version-1 category selection. It uses the frozen category ID, never the current unit's compatibility `categoryKey`, and checks current consent and unit eligibility in each candidate transaction. The replacement must fit the accepted price cap; its authoritative price and selection evidence are preserved. Accepted cancellation policy is unchanged.
- Missing, malformed, mismatched, unknown-version and legacy category-ID-only snapshots do not authorize substitution. Older API versions allowed a category ID alongside an exact unit, so legacy IDs are ambiguous. Such requests may still be approved on their original eligible unit; otherwise they remain requested and require renewed guest consent. No automatic historical backfill is safe or included.
- Category quoting, creation and approval can skip commercially unquotable units and capacity conflicts. Creation/approval also skip units above the accepted cap, returning `REQUOTE_REQUIRED` if necessary. Unexpected database/pricing faults are not converted into sold-out inventory.
- Quotes are not holds. Unit/review actions require explicit availability for the current selection. Canonical locking, blocked-date/source-authority checks, exclusion constraints, idempotency, payment rails and final price checks still decide the write.

No schema migration is required for this versioned extension of the existing snapshot. Do not backfill consent from category membership or roll back to the old membership-based substitution behavior. Broader DB/browser release verification is recorded separately in `docs/audits/BOOKING_INVENTORY_SELECTION_2026-10-09.md`.
