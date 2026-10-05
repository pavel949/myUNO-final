# Stitch schema ↔ myUNO canonical schema — reconciliation

Date: 2026-10-05 · Source: `myuno_schema.prisma.txt` (Stitch export, 22 models / 19 enums)
Compared against: `prisma/schema.prisma` (114 models / 90 enums, the canonical, production-applied schema)

**Verdict in one line:** the Stitch schema is a *demo-shaped sketch of what its screens display*. The repo
schema already models almost all of it, more carefully (scoped roles, config-driven fees, content keys,
integer satang, readiness gates, encrypted PII). Nothing is replaced and nothing is laid on top. Three small,
additive gaps are proposed (§3) and are **drafts awaiting approval** — no migration was applied.

## 1. Model-by-model

| Stitch model | Canonical equivalent | Verdict |
|---|---|---|
| `User`, `Session` | `Identity` + `RoleAssignment` (scoped to project/unit/org/provider) + `AuthAccount` | **Covered.** A single `User.role` enum cannot express "owner of unit A, guest of B, admin"; roles are data. Passport fields on the user row are rejected (§2). |
| `AuditLog` | `AuditLog` (`actor`, `action`, `entityType`, `entityId`, `data` JSONB, `at`) | **Covered.** `diffJson` = `data`. `ipAddress` deliberately not stored (PII). |
| `Destination`, `DestinationArea` | `Area` (tree, `parentId`) + destination config in code (`src/modules/destinations`) | **Deferred.** One real destination (Phuket). Add a table when a second destination has real supply (see ROADMAP). Not a gap today. |
| `Project` | `Project` (74 fields: location, lifecycle, phases, facilities, hospitality config) | **Covered, richer.** `isPublished` boolean → replaced by readiness gates (media, permitted use, authority). `hasPool/hasGym/hasReception24h/saltoKs…` defaulting to `true` are invented facts → rejected; facilities are evidenced data. |
| `InventoryCategory` | `InventoryCategory` + `InventoryCategoryMedia` | **Covered.** `nameRu/nameEn` → content keys (i18n layer). `representativeImages[]` → media links. |
| `Unit` | `Unit` (82 fields) + `UnitEngagement` + `UnitAccessInstruction` (encrypted) | **Covered**, with 2 live-state fields not stored (§3, G3). `unitNumber`→`name`, `building/floor`→`structureNode`/`floor`, `viewType`→`views[]`, owner→`ownerIdentityId`. Smart-lock/HVAC ids belong in `ExternalMapping` (integration seam), never as defaulted columns (`battery 94%`). |
| `OperatingMandate` | `UnitEngagement`, `ManagementContract`, `ProjectOrganizationRole`, responsibility scope (shipped) | **Covered.** Hard-coded 80/20 revenue share rejected: fees are config per engagement (`feeOverridePct`, doc 04). |
| `CommercialOffering` | `CommercialOffering` (`offeringType`, `pricingTerms` JSON, `ownershipTenure`) | **Covered.** Typed lease columns → inside `pricingTerms`; long-term search contract already shipped. `projectedNetRoiPct` rejected (§2). |
| `Booking` | `Booking` (+ `ReservationGroup`, `BookingGuest`, `BookingChange`, `Tm30Filing`, `Payment`) | **Covered**, one gap: human reference (G1). Voucher code = derived from the booking, not a column. `wifiPassword`/`saltoPinCode` → `UnitAccessInstruction.ciphertext` (encrypted), never plaintext/defaults. Totals are server-computed `priceBreakdown` (satang), not client columns. |
| `GuestFolio`, `FolioLineItem` | `Payment` + `LedgerEntry` (append-only) + `ServiceOrder` + `Refund` | **Read model, not a table.** A second folio ledger would be a mirror that can drift. Build `/…/folio` as a view over canonical rows (reconciliation row "Guest folio"). |
| `VendorPartner`, `ServiceCatalogItem` | `Provider`, `Service`, `ServiceProject`, `ServiceQuote*` | **Covered.** `commissionRatePct 20` → `take_rate_pct_snapshot` per order from config; `rating default 4.9` → rejected (no invented ratings). |
| `ServiceOrder` | `ServiceOrder` (42 fields, state machine placed→…→closed) | **Covered**, one real gap: live dispatch (G2). |
| `HousekeepingTask` | `OperationalTask` (`turnover_cleaning`, `deep_cleaning`, …) | **Covered.** |
| `CleaningInspection` | `OperationalTask(turnover_inspection)` + `ConditionReport(+Media)` + `OperationalTaskMedia` | **Mostly covered.** Zone checklist is a small gap (G4, optional). |
| `MaintenanceTicket` | `OperationalTask(maintenance_followup)` + `Ticket` + `PreventiveMaintenancePlan` + `BlockedDate` (OOD = `blocksInventory`) | **Covered.** |
| `AgentDeal` | `CrmOpportunity` + `PropertyDeal` (+ open draft PRs #189, #191, #192: agent workspace / distribution controller) | **Do not add a competing model.** Agent Hub must be built on CRM + the agent-distribution PRs. |
| `LedgerTransaction` | `LedgerEntry` (typed, append-only, linked to booking/order/payment/payout/statement) + `EarnedFee` + `OwnerStatement` | **Covered.** The ledger's vocabulary is schema by design (doc 04 §9). |
| `PayoutAccount` | `Provider.payoutMethod` JSON, `Payout`, merchant config | **Covered.** `cryptoWalletUsdt` rejected. |
| Enums `UserRole` | `RoleType` (+ `OperatingTeam`, `ProjectStaffPermission`) | Front-desk/housekeeper/engineer/night-auditor are **permissions on a team**, not new global roles. |
| Enums `BookingStatus`, `PaymentStatus`, `ServiceOrderStatus` | same names, different (richer, tested) state machines | **Keep canonical.** Stitch's values would break guarded transitions. |

## 2. Rejected on principle (project non-negotiables)

- `PaymentGateway.CRYPTO_USDT`, `PayoutAccount.cryptoWalletUsdt` — **crypto is not accepted** (SEC/BOT-licensed activity, Q21). Also "USDT" appears in Stitch marketing copy: excluded.
- `User.passportNumber/passportCountry` plain columns — passports are PII, encrypted field-level (AES-256-GCM) with access logging (PDPA, doc 12).
- Defaulted secrets/facts: `wifiPassword "legendary2026"`, `saltoPinCode`, `rating 4.9`, `smartLockBatteryPct 94`, `hasReception24h true`, `isPublished true` — **no invention**; missing truth must be `unknown`/disabled.
- `revenueShare 80/20` baked into a mandate/ledger — fees are **config per engagement**; platform fee is fixed by policy (10%), not 20%.
- `projectedNetRoiPct` / "ROI 8.4%" / "доходность до 11.4%" — **no yield promises**.
- Role read from a cookie in the proposed `middleware.ts` (`myuno_user_role`) — a client-readable cookie is forgeable. Authority stays server-side via `core.can()` and signed sessions. **Not adopted.**
- `Decimal` THB → money is integer satang everywhere.

## 3. Proposed additive changes (DRAFTS — need approval; nothing applied)

See `proposed-migration-DRAFT.sql`. All are nullable/additive (expand step), no data rewritten, no existing
column or enum changed.

- **G1 — `booking.reference`**: short human reference (`UN-84920`) for PMS, folio, voucher and support. Nullable, unique; generated on create, backfilled later in a separate step. Today ids are UUIDs.
- **G2 — `service_order_dispatch`**: 1:1 with `service_order`: `staff_name`, `staff_phone`, `eta_at`, `stage` (`assigned|en_route|in_service|done`), `last_position` (lat/lng, nullable), `updated_at`. Lets "live tracking" exist **without touching the guarded `ServiceOrderStatus` machine**. RLS on, server-only.
- **G4 (optional) — `operational_task.checklist`**: JSONB, nullable — zone results for inspection (`[{zone, passed, mediaIds}]`); photos stay in `operational_task_media`.

Not proposed (derive instead): folio (view), voucher (view), unit live cleanliness/occupancy board (**G3**: computed from `OperationalTask` + `Booking` + `BlockedDate`), destination table (deferred).

## 4. Decision needed from the founder

Approve / amend / reject G1, G2, G4 (the SQL is in `proposed-migration-DRAFT.sql`). Until then the app is unchanged at the schema level.
