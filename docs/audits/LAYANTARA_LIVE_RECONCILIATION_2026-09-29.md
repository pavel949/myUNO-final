# Layantara → myUNO: live, read-only reconciliation

**Observed:** 2026-09-29 03:05 UTC. **Source:** connected Layan Tara OS Supabase, **destination:** connected MyUno-final Supabase. These queries were executed read-only; no production writes, migrations, credential changes, activation, booking insertion, or deployment took place.

## Evidence as of this snapshot

| Check | Source | Destination | Result |
|---|---:|---:|---|
| Physical inventory | 39 active operational_inventory | 39 source-linked draft Unit (44 including 5 other live units) | 39/39 source ID links; category identity, bedrooms and normalized bathroom values match |
| Canonical categories | 8, all used | 8 mapped draft InventoryCategory | 8/8 mapped; not yet active |
| Category rate identities | 72 active category_rates | 72 distinct sourceRateId values in tariff-grid snapshots | 72/72 exact set match; **not** policy approval |
| Source media | 67 villa_media on 5 physical villas | 67 MediaAsset/UnitMedia and photo mappings on 5 units | Source ID, unit assignment, path suffix, MIME and sizes match; links still point to source Supabase public bucket |
| Current active occupancy | 84 (83 imported reservations, 1 owner stay) | 84 mapped protective BlockedDate (83 ota_import, 1 owner_hold) | 84/84 exact source ID, mapped physical unit, check-in and exclusive checkout; no mismatch |
| Future active occupancy | 70, covering 31 villas | Mapped protective blockers; 70 future target blocked rows | Source and target counts coincide at snapshot; need final delta/cutover freeze |
| Source occupancy disposition | 100 (84 active / 12 cancelled / 3 released / 1 expired) | Only 84 active source rows mapped to protective blocks | Historical/nonactive rows intentionally do not automatically become active restrictions |
| Booking records | Source operational_reservations 0; legacy reservations 7 | Canonical Booking 0 | No canonical booking/guest/financial migration proof |
| Financial records | Source legacy payments 6 | Target Payment 0 | No full financial reconciliation; do not fabricate payments |
| Commercial offerings | Source 72 rates, policy source | 39 short_term_stay drafts + 39 long_term_rental drafts | Zero active mapped offerings; taxPolicyVerified count zero |
| Booking ownership | Source is current writer | external_system status staging, bookingAuthority source, cutoverVerified false | Correctly protected / **not cut over** |

**Media:** All 67 target storage URLs point at the original Layantara Supabase public storage. Exact metadata/path mapping is not a byte-copy integrity check. The target does not have an independently verified native copy. There are no physical unit-specific source photos for 34 villas; representative category photos must never be silently presented as photographs of those private villas.

**Important:** No user identity, guest PII, passport, source secret, financial personal record, or full source URL is embedded in this report.

## Hard fail-closed gates

The release must not activate Layantara booking, long-term leasing or OTA push unless all these are evidenced:

1. Run release branch CI on the *exact* deploy SHA: lint, Prisma validate/generate, clean PostgreSQL migration replay and drift = zero, full tests, Next build and role smoke.
2. Prove an isolated restore from immutable pre-cutover source and target backups.
3. Reconcile 39/39 source IDs to category/unit, verify 8/8 specifications with an authorized operator and correct missing physical data, cover media and typed gallery scopes; preserve missing values as pending, never synthetic.
4. Verify 72/72 tariff identities, **independently approve the tax and booking policy**, check exact quote/booking equality and seasonal overlap cases (daily/weekly/monthly/annual, discounts, fractional THB); keep offerings draft otherwise.
5. Preserve all source media, obtain destination-owned/independently verified bytes and hashes or accept an explicitly documented long-term, source-owned media dependency with failover. **Do not claim byte migration from URL mapping.**
6. Capture a same-transaction/consistent-source snapshot and repeat the complete 100/100 occupancy disposition, 84/84 active protection mapping, latest future occupancy and all subsequent source deltas. Quarantine any conflict. Do not delete source protective blocks before a financially verified canonical booking is committed.
7. Reconcile the 7 legacy bookings, imported worksheet, booking terms, agency attribution, owners, refunds, payment and deposit ledgers **before** any historical conversion. User may explicitly defer historical records, but future/ongoing occupancy must remain protected with a source writer or verified canonical record.
8. Run direct and OTA collision tests, payment confirmation/refund, owner isolation, staff invitation/roles, all three shared calendar scopes, Stay 360, Gallery upload/reorder/cover, Lease/Sales signing, rollback and last-delta replay. ARI push requires an actual provider acknowledgement, not a manually set flag.
9. Freeze source booking writers and OTA sync for affected units only after verified cutover timing; capture final delta. Confirm no active source endpoints still accept booking writes. Flip booking authority and sellable statuses **only in a serialized, audited activation** after sign-offs; validate one writer, positive price/availability and exact deployment SHA.
10. Monitor source/target deltas, invalid/replayed event inbox, booking 409s, settlement, source link availability and inventory conflict alarms. Rollback means freezing both writers and replaying/compensating post-cutover writes; never resume a stale source calendar.

## Today's operational decision

**NO-GO for live cutover.** Physical identity, source-rate ID coverage and active protective occupancy are reconciled, but source authority is still active, no imported villa is live, none of the 78 offerings are activated, tax/booking terms are not verified, 34 villas lack exact-unit gallery coverage, file-byte independence is unproven, and no live booking/financial conversion is reconciled. A green code CI is necessary but cannot override these business and data gates.

The staged branch must retain bookingAuthority=source, cutoverVerified=false, target units/categories/offers draft and all 84 protective blocks. Do not mutate production until the release record in docs/architecture/LAYANTARA_RELEASE_AND_ROLLBACK.md is signed and current snapshots are rechecked.
