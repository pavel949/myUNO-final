# Consolidated release: Property → Offering → Booking → PMS → Finance → Owner Hub

Date: 2026-09-29. Branch: `release/layantara-unified-cutover`. Source PRs: #139 and #140. This is a pre-cutover evidence ledger; source snapshots and real production data are NOT authorized for activation by test-file existence.

## Consolidation result
All seven files from #140 were verified byte-identical in #139 before #140 was closed as superseded. No competing booking, pricing, CRM or owner models were created.

## Canonical chain and executable evidence

| Handoff | Canonical fact | Executable verification | Risk / cutover gate |
| --- | --- | --- | --- |
| Project → physical category/unit | Project → InventoryCategory → Unit; no second villa | `property-to-financial-close.integration.test.ts`; 39-unit crosswalk in staged data | 39 REAL villa identities and 8 categories must match signed source |
| Unit → commercial offers | Multiple CommercialOffering rows reference SAME unit; unique unit + type | property-to-financial-close integration creates short-term and sale offers | Layantara offers remain DRAFT while tariff validation/authority missing; draft offer is not automatically sellable |
| Quote → Booking | Unit base-nightly + PricingRule is current authoritative stay pricing until explicit RatePlan cutover | `createBooking` server recomputes price; overlap test and `booking_no_overlap` DB constraint | no competing quote engine, preserve booked term snapshots |
| Layantara authority → occupancy | `external_system.system_key=layantara_os`, one verified unit mapping; protective blocks are not bookings | channel-service integration: replay/stale/conflict/source-owned exclusion | block new writes while source owns inventory; no false instant confirmation |
| Booking → PMS | one Booking moves through check-in, checkout, complete; no duplicate Stay transaction | property-to-financial-close integration | real guest IDs, stay state/requests and staff ownership must reconcile |
| PMS → payment/ledger | payment success and rental-revenue ledger are linked to booking | cash-payment/finance + channel-service integration | never infer received cash from OTA booking confirmation; receipt evidence required |
| Ledger → owner statement | one statement per unit/period, line items link to source booking | property-to-financial-close integration | historical booking/payment identity, cross-period allocation and contractual waterfall must be validated |
| Statement → Owner Hub | draft hidden; published visible only to verified owner; foreign owner rejected | extended property-to-financial-close integration | scoped API/SSR/aggregate/media tests before cutover |
| Owner dashboard month view | completed stays included; cross-month gross booked value apportioned exactly in satang | owner-period-allocation unit tests | display is booked gross, NOT receipt/NOI/payout ledger |

## Read-only real-data activation check
Run `scripts/layantara-cutover-readiness.sql` only as an authorized operator against the intended target after staging migrations. It emits aggregate PASS/BLOCK checks for snapshot parity, 39 real unit mappings, 8 categories, verified coordinates and specs, physical media, validated short-stay offers, and source-authority preservation. It does not activate inventory or expose PII; payment, booking, staff and legal/compliance reconciliation still require independent signed evidence. A BLOCK is expected while staging is intentionally incomplete.

## Corrections included in consolidated branch
- Admin Layantara mapping counter now queries `layantara_os` rather than the nonexistent `layantara` key used in that card.
- Commercial offering and owner-visibility checks extend the existing full-chain DB integration test.
- Owner dashboard now includes `completed` bookings and splits cross-month gross by calendar nights without duplicate total, preserving one exact satang sum across adjacent months. Owner statement remains the financial authority.
- Guest return path and CRM ownership/mandate guard are inherited from #140. Root navigation includes the new guest label and avoids the duplicate Trips link.

## Run these checks on this exact branch HEAD, with isolated test database
1. `npm ci`, `npx prisma generate`, `npm run lint`, `npm test`, `npm run build`.
2. Controlled clean migration replay and `npm run db:verify`, drift diff against isolated DB; no automated repair in build.
3. `npx vitest run src/modules/workflows/property-to-financial-close.integration.test.ts src/modules/integrations/layantara/channel-service.integration.test.ts src/modules/integrations/layantara/unified-outbox.integration.test.ts src/modules/projects/owner-period-allocation.test.ts` with `DATABASE_URL_TEST` and expected test setup.
4. Authenticated browser acceptance as admin, ops, guest, owner and foreign owner. Test live calendar, quote/hold, no-overbooking, payment ledger, stay progression, statement publication and owner visibility.
5. Reconcile 39 source villa IDs, categories, tariff grid, photos, booking/blocks, staff, compliance, location coordinates and signed money balances. Quarantine ambiguous rows; maintain source authority and draft statuses.
6. Confirm backup/restore, strict health, source outage fail-closed behavior and production environment identity before any separate authorized cutover.

## Status semantics
Code present: YES. Consolidation: VERIFIED identical for #140 files. Test execution on latest branch: NOT YET VERIFIED in this ledger. Production migration and real-data cutover: NOT EXECUTED. Release remains draft until recorded independent evidence, not a synthetic health score.
