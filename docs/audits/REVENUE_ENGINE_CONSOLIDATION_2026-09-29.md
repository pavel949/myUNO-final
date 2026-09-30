# Revenue, booking and catalog consolidation — 2026-09-29

## Scope decision
Historical Layantara bookings and historical financial records are retained in the private immutable snapshot but are NOT release gates for the catalog/revenue migration. Current/future occupancy (84 active source protections), open reservation obligations and channel authority STILL block double-selling; do not discard them. No synthetic paid bookings or financial balances.

## Actual engine comparison
| Capability | LayantaraOS (source) | myUNO (target) | Decision |
| --- | --- | --- | --- |
| Physical inventory | operational_inventory + crosswalk, separate demo villas | Project → InventoryCategory → Unit and external mapping | myUNO physical graph owns 39 real units |
| Seasonal daily/monthly/yearly rates | 72 source category rates, 5 daily/3 monthly/1 yearly seasons; 84 channel rates | canonical PricingRule/RatePlan and commercial offers | Preserve complete grid and use shared seasonal tariff resolver; no legacy quote RPC at runtime |
| Booking terms | 7 condition rules; seasonal min stay, 50% confirmation, deposits, cancellation | canonical Booking snapshots, cancellation rules, payment and ledger | normalize terms into immutable quote/booking snapshot; approval gate before sale |
| Tax/fee semantics | published daily rates include tax/service/breakfast, monthly rates tax-exclusive; source booking text sometimes contradicts inclusions | configurable scoped tax/fees | explicit taxPolicyVerified, no double VAT or automatic LOS discount |
| Availability | 100 operational occupancies / 84 active source protections | BlockedDate + booking exclusion/concurrency guard | preserve active blocks until verified canonical replacement |
| Booking lifecycle | source resort-specific reservations / quote RPC | one Booking + PMS + owner + finance | preserve myUNO transaction engine; do NOT import second PMS |
| Agent calculator | compatibility wrapper of source quote SQL | future same myUNO quote contract | no parallel arithmetic; agent pricing becomes a view on canonical quote |
| Yearly lease | annual row priced per month | annual commercial offer + owner/legal lease | admin contract preview only; not instant nightly Booking |

## Implemented in consolidated PR #139
- Shared `src/modules/core/seasonal-tariff.ts`: strict date-only seasons (inclusive month/day; exclusive checkout), daily published rates and 30-night month allocation in integer satang; refuses missing/ambiguous/unsellable tariff and mixed inclusions. Annual contractual preview separate.
- Shared `computeCanonicalPriceBreakdown`: validated active offers with `quoteEngine=canonical_tariff_grid_v1`, reviewed tax policies and (for imported source terms) approved booking rules. Both public quote and booking API call this same function, so no duplicate price engine.
- `src/modules/core/commercial-booking-terms.ts`: maps seasonal confirmation %, security deposits and cancellation/stay rules into snapshot. No automatic payment capture based only on the source text.
- Admin unit onboarding has a reachable tariff preview endpoint/UI for daily, monthly, annual plans and source policies, including while offers are draft; preview does not activate sales.
- Separate `scripts/layantara-commercial-parity.sql` (executed read-only) validates real 39 physical units, 8 categories, 78 offers, exact 72 source-rate IDs, 24 category translations; distinguishes demo `villas` records.
- Full-source snapshot remains lossless and private. Existing source photo links cover only 5/39 physical units; rehosting requires physical SHA-256 parity.

## No silent approval
Source `villas` has 39 LT-* demo rows (`rate_is_demo=true`) with descriptions which do NOT map to the physical operational unit codes. Do not import those copy fields as authentic physical-villa descriptions. Use 24 real localized category descriptions and separately approved physical-unit copy. Source has zero gallery/hero URLs in demo `villas`; 67 real `villa_media` rows cover only 5 physical villas. Missing 34 villa galleries require genuine assets, not fabricated defaults.

The 72 source tariff IDs are fully present in the 78 canonical offer grids, but the imports have `quoteEngine=pending_validation` and are draft. The legacy source policy states VAT excluded on one example while rate metadata marks daily taxes included; this requires tariff/policy sign-off. No live offering or payment permissions may be enabled from a raw source flag. Existing source protection remains active.

## Remaining acceptance
1. Independent scenario parity with source quote over all seasons and 8 categories, including cross-season, peak, minimum nights, daily/monthly, net agent rates, taxes, deposits and partial/failed charges. Record absolute satang differences; zero unexplained.
2. Integrate agent pricing and revenue dashboard as READ MODELS over one myUNO rate and booking source; no duplicate quote or source RPC after handover.
3. Fully source/target media-byte verification and owner-approved physical copy/specifications.
4. Current/future occupancy and source-authority handover. Historical money and past booking import may be deferred to a separate archival batch with provenance.
5. CI, test DB migration replay, TypeScript, production build and role-appropriate browser journey audit.

## Future complexes
This calculator takes a CommercialOffering tariff grid, not a hardcoded Layantara ID or direct source DB call. Future resort adapters normalize dates, taxes, seasons, rate units and booking policies into the same validated canonical contract. Release by project/offer, not by copying the entire PMS.
