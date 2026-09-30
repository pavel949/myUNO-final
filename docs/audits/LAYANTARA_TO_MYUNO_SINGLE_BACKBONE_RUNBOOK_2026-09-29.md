# LayantaraOS → myUNO OS: single-backbone migration runbook
Date: 2026-09-29. Change control: consolidated PR #139. Source Supabase project `omwoglpcwaiflaprgrne`; target `burcnghheyzbzffzgmjz`. **This is not cutover approval.**

## Scope amendment (2026-09-29): commercial-engine release
Historical Layantara bookings and finance remain immutable archival evidence and do **not** block the catalog/tariff-engine release. Only current/future occupancy, source-authority handover, validated pricing/booking policy, safety and compliance block live bookings. Historical booking and payment conversion is a separate optional archival workstream. See `docs/audits/REVENUE_ENGINE_CONSOLIDATION_2026-09-29.md` for the updated execution contract.

## Architecture and non-negotiable authority
myUNO is the sole future application/backbone: Identity/RoleAssignment, Project → InventoryCategory → Unit, CommercialOffering and one server quote, Booking and BlockedDate, PMS work projections, Payment/Refund/Ledger, OwnerStatement/Owner Hub, ContentKey/Translation, MediaAsset, and one event/outbox model. Source LayantaraOS is a TEMPORARY read-only legacy source / audit archive until an independently signed cutover. Source and target must never both accept new operational writes for the same physical unit. No per-resort fork or duplicate PMS database is permitted after cutover; tenant-scoped configuration handles new complexes.

The private `layantara_copy.source_row` and `import_audit` hold lossless, hash-audited source evidence; they are not a second operational model. `external_system`/`external_mapping` connect provenance, replay and recovery. Existing integration code is an anti-corruption layer, not an indefinite bidirectional writer. Source-controlled availability stays blocked by application and database guards while `bookingAuthority=source`.

## Verified target snapshot (read-only queries, 2026-09-29)
53/53 table audits verified with matching copied/source counts and checksums; 39 physical units, 8 categories, 39 crosswalks, 72 source tariff rows in rate matrix, 78 draft offers (39 daily + 39 long-term), 67 unit-media links on only 5 physical villas, 24 localized category descriptions, 84 protective occupancy blocks. Source has 7 `reservations` (3 confirmed, 2 in_house, 1 pending, 1 completed), 100 `operational_occupancies` (84 active), 95 source reservation blocks (82 confirmed, 1 pending, 12 cancelled), 6 paid `payments`. Target has zero canonical Layantara bookings and zero payment mappings. Physical specifications: 8 confirmed, 31 pending. Project coordinates are (0,0). Source retains authority and no units/offers are live.

## Entity mapping contract
| Source Layantara | Canonical target | Migration semantics |
| --- | --- | --- |
| projects, project_public_profile, property_operating_profiles | Project, localized ContentKey, project-level config | preserve source payload; verify physical address/coordinates before public |
| villa_categories, operational_inventory, villa_master_crosswalk | InventoryCategory + physical Unit + ExternalMapping | 8 categories, 39 exact IDs; no guessed physical labels/specifications |
| rate_seasons, category_rates, channel_product_rates, pricing_* | immutable source snapshot → RatePlan/PricingRule/CommercialOffering terms | 72 category rates and 84 channel rates reconciled by season/window/currency/tax/commission; stay quote engine must explicitly supersede source after parity, never invent nightly quotes from monthly rates |
| villa_media | MediaAsset + UnitMedia (provenance mapping) | 67 metadata links; only 5 units actually have photos; physical bytes must be rehosted and compared SHA-256 before source bucket retirement |
| villa_category_content | ContentKey/Translation for EN/RU/TH | 24 localized rows, preserve exact text and review status; no English fallback masquerading as translation |
| booking_condition_rules, project_commercial_policies | versioned offering rules, cancellation/payment/deposit snapshots | 7 condition rules and 14 project policies remain traceable; acceptance freezes terms on Booking |
| reservations and operational_occupancies/source_reservation_blocks | Booking + BlockedDate + BookingChange | resolve source identities and overlapping ranges; 84 active occupancy protections are NOT automatically 84 reservations; map each of 7 reservation records explicitly |
| payments and financial source rows | Payment/Refund/Ledger/OwnerStatement | 6 paid source rows demand bank/receipt identity and satang-exact reconciliation, not inferred revenue from occupancy |
| housekeeping_jobs, maintenance_tickets, tasks, alerts | canonical Work/Task/Ticket/notifications | preserve state, assignment, history and source IDs; no parallel resort task engine |
| source users, staff, access and mandate | Identity, Organization, scoped RoleAssignment, contract and protected access instruction | never grant owner role from CRM stage or unverified source text |

## Execution phases (release gates)
0. **Freeze baseline**: source and target backup/restore rehearsal, live source revision and table/byte manifest; pin application commit and migration version. Run read-only source/target aggregates independently; signed discrepancy report.
1. **Lossless private staging**: replay idempotent source snapshot with source_id/payload checksum; compare all rows; retain previous versions/tombstones. Reject silent overwrite on source changes.
2. **Canonical identity and property**: verify all 39 physical-unit crosswalks and 8 categories; clear 31 physical specification questions, GPS, permitted use, owner/mandates and staff scopes.
3. **Content/media/rate conversion**: attach EN/RU/TH descriptions, rehost all source photos with source/target SHA-256, map 72 rates and 84 channel records including windows and rules. Approved business user signs a priced quote-parity matrix (daily/weekly/monthly, commission, taxes, deposit, cancellations).
4. **Occupancy/booking and money**: reconcile seven reservations, 84 active occupancy entries, 95 source blocks and six payment receipts; group source rows by physical unit, date range, external booking identity. Protect unsolved occupancy; never convert a protective block to a booking without validated guest/amount/terms. Replay idempotently; compare all totals and balances.
5. **Operations & Owner**: map stay status, prearrival, team/tasks, issues, legal compliance, signed contract, statement source line items and owner-scoped visibility. Verify one booking and one financial journal, no duplicate PMS transaction.
6. **Shadow parity**: myUNO reads and independently computes availability/price/finance against source snapshots with NO outgoing sale/confirmation; reconcile fresh source deltas and simultaneous arrivals, changes, cancellations, payments. Log per-object parity and negative cases.
7. **Atomic authority handover**: in a controlled maintenance window pause source writers/channels, capture final delta and immutable manifest, apply verified mapping/booking/financial replay, prove no conflicts, switch per-project authority in a single audited operation, enable channels only after strict checks. Prevent legacy writes by revoking write credentials / disabling jobs/webhooks at source, not merely hiding old UI.
8. **Post-cutover soak**: test live staff/owner/guest flows, refunds, calendar updates, media, owner statements, strict health, backup/restore, failed event replay. Legacy database retained READ-ONLY until retention and reconciliation approval. Decommission app, cron and competing sources only after evidence.

## No-go and rollback
Hard blockers: any unresolved live occupancy/booking/payment identity, non-exact monetary balance, unverified tariffs or legal use, failed blob checksum, missing owner/staff scope, test/drift/build failure, unproven backup restore. Rollback BEFORE accepting new myUNO writes: return authority to source and replay final delta. AFTER new myUNO transactions: do not flip source writers back blindly; pause both, reconcile journal/outbox by identity and version, produce a recovery plan and seek sign-off. Never delete source snapshots or source files to manufacture a green report.

## Generalization to future complexes
Onboarding is configuration-driven through one project wizard and typed import adapter: project → category → physical unit → owner/contract/compliance → offerings/prices/media → inventory authority → team/channels → readiness. Each external system gets namespaced IDs, signed events, monotone version checkpoint, idempotency key and explicit source-of-truth registry. The same booking/finance/owner services serve resorts, villas and condos. New complexes require adapters and facts, NOT new booking/owner/finance tables or separate management dashboards.

## Executable evidence
- `scripts/layantara-cutover-readiness.sql`: project/physical/spec/photo/price/authority gate.
- `scripts/layantara-obligation-reconciliation.sql`: snapshot, rates/media, occupancy, seven reservations and payment-evidence gate.
- `scripts/layantara-rehost-photos.ts`: dry-run by default, opt-in physical copy with SHA-256 read-back; source retained.
- `src/modules/workflows/property-to-financial-close.integration.test.ts` and `src/modules/integrations/layantara/*.test.ts`: canonical chain and source-guard regression.
- `docs/audits/CONSOLIDATED_CHAIN_PREFLIGHT_2026-09-29.md`: release acceptance ledger.
- Full CI/build/isolated migration replay and signed runtime/browser/owner isolation are mandatory. Code green does not equal data parity.
