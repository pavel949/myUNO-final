# myUNO-final — 12-process / 7-engine implementation audit

Date: 2026-09-28. Compared `main` (`00836c1`) with draft PR #137; reviewed source, schema and GitHub CI. This is **source-based verification**, not a production E2E certification. Do not infer live dataset migration from the presence of schema, seed or route code.

## Architecture
- One `Identity` with multi-role `RoleAssignment`, platform/project/unit scopes and permission checks: `prisma/schema.prisma`, `src/modules/core/permissions.ts`. Owner/ops surfaces exist.
- One `Project → InventoryCategory → Unit` physical inventory graph; `CommercialOffering` attaches terms to unit/project. `Unit` unique on `(projectId, name)` (not an external physical-asset ID).
- `Booking` is the canonical single-unit reservation and stay record. `ServiceOrder` is a separate typed order linked optionally to `Booking`/`Unit`/`Project`.
- Payment, refund, deposit, `LedgerEntry`, `OwnerStatement`, `Payout` exist. This is a single-entry operational ledger, not proof of full accounting close.
- Process Map screen is navigation + aggregate projection; it is **not** an executable state-machine/passport implementation. Compare `docs/canonical/PROCESS_MAP.md`, which defines 30 CO process passports.

## Twelve blocks: supported code vs remaining target

| # | Process | Source-backed implementation | Remaining acceptance gap |
|---|---|---|---|
| 1 | Identity & Access | `Identity`, `AuthAccount`, scoped `RoleAssignment`, `permissions.ts`; admin/owner/staff surfaces | Full multi-role browser scenarios; session/access revocation; per-object isolation in every API |
| 2 | Property Onboarding | Project wizard, category/unit, owner invite, media, compliance/readiness, commercial offers, BAR; `getPropertyReadiness` | Wizard still hands some steps off to other screens; no verified all-fields/translation/key-code end-to-end import; legacy projectType null bypasses advanced readiness gate |
| 3 | Inventory | `Booking`, `BlockedDate`, exclusion/no-overlap, category assignment, scoped calendar, iCal import | Full resort/category/unit **date-grid** parity and real-time refresh not proven; OTA ARI outbound push missing |
| 4 | Pricing | `InventoryCategory` + BAR `RatePlan`, `PricingRule`, `computeCanonicalPriceBreakdown`, central `getConfig` | Full weekly/monthly/yearly/agent sale-offer parity and every tariff/discount/fee combination unverified; quote record not separately persisted |
| 5 | Booking | Direct/request flow, server recomputes price, hold and overlap guards, payment, modification, refunds | Agent/OTA/manual and end-to-end UI flows need per-channel acceptance; external OTA ARI push absent |
| 6 | PMS | `Booking` status lifecycle, pre-arrival/ops, check-in/out, TM30, condition reports, one stay record | Production user journey + automated housekeeping/pre-arrival task readiness and deposit release not fully evidenced |
| 7 | Property Operations | `Ticket`, `TicketEvent`, reports, compliance/mobilization/incident surfaces | One consolidated staff task view and complete housekeeping/maintenance automated handoff not evidenced |
| 8 | Sales & CRM | `CrmProfile`/`CrmOpportunity`, linked project/unit, buyer interest, `CommercialOffering` | Full showing→reservation→sale contract→settlement/agent commission not established; no separate `SalesTransaction` model |
| 9 | Owner Hub | Owner-specific dashboard, owner stays, statements/sign-off, payout records, scoped backend services | Verify owner isolation in live roles, blocking/alerts, commission/split rules, actual payout bank matching |
| 10 | Partner & Agent | Provider management and attribution reports, agent booking channel enum | Dedicated agent quote/link/booking/commission payable workflow not evidenced; provider portal is not equivalent to agent hub |
| 11 | Concierge | `Service`, `ServiceOrder`, `Payment`, provider, optional unit/booking context, lifecycle endpoints | Individual vertical UX and quote/resource fulfilment, refund and provider reconciliation need acceptance |
| 12 | Finance & Admin | Payments, refunds, deposits, ledger, statements, payouts, analytics, audit | Full FIN-01 incl commission, all refunds, cross-period stay allocation, bank reconciliation and signed owner close not certified |

## Seven engines
- Identity & Access: implemented core, verify access matrix live.
- Property & Inventory: implemented core, gaps in external asset identity, completeness and offer read/write coverage.
- Availability: canonical booking + blocked-date backend, scoped calendar, inbound iCal; **no verified ARI push**.
- Pricing & Quote: canonical computation used by booking and quote endpoints; complete tariff matrix and persisted quote needs acceptance.
- Booking & Order: Booking and ServiceOrder distinct correctly; correlation by IDs, but multi-unit order scope and agent sale flow not certified.
- Payments & Ledger: atomic cash/transfer/card changes in PR #137; production provider/webhook and whole close not certified.
- Workflow & Operations: domain statuses/tickets exist, no single engine proving all 30 process passports.

## Critical findings
1. **Fixed in PR #137:** public project category query filtered `status='active'`, while schema/default, wizard and inventory seeds create `status='live'`. Real live villa categories could disappear from public detail; updated `public.service.ts` and test.
2. **Fixed in PR #137:** checkout client had an unclosed conditional JSX; older CI failed lint parser on `src/app/checkout/[sessionId]/checkout-client.tsx`; corrected.
3. Public homepage `listPublicProjects()` filters `Project.status='live'`, orders by creation, and shows first 3. It does **not** filter active management engagements or prioritise Layan Tara/Legendary/Serenity; it is not a validated managed-portfolio showcase.
4. Property activation gate skips the richer report when `Project.projectType` is null (legacy compatibility). Correct for migration, but cannot claim every live property passed the new wizard.
5. Calendar index is a scoped project/category/unit navigator; it does not itself render a consolidated full-resort date grid.
6. `CommercialOffering` and `ChannelMapping` are present, but no evidence of outbound OTA ARI parity. Inbound iCal sync is implemented and warns on errors; inbound calendar feed is not a real-time channel manager.
7. `CrmOpportunity` and `CommercialOffering` do not by themselves implement sale contract, close, legal ownership or agent commission payout.
8. Process Map cards show live counts but only navigation for some modules; the partner card has no derived state. Do not treat 12 cards as 12 completed workflows.
9. No source evidence in this audit establishes the actual LayantaraOS booking/media/tariff row-by-row migration or its live production accuracy.

## Acceptance evidence: seven required scenarios
| Scenario | Source coverage | End-to-end acceptance |
|---|---|---|
| AUTH-01 | Auth/roles and permission tests exist | Real multi-role UI + server denial matrix not observed this audit |
| PROP-01 | Wizard/readiness and project/category/unit routes | Full form/media/rate/publish browser journey not observed |
| INV-01 | BlockedDate, booking constraint, calendar and iCal import | Resort/category/unit browser and OTA propagation not observed |
| RATE-01 | Server canonical calculator, policies | Full tariff/discount/tax regression matrix not observed |
| BOOK-01 | Booking service, payment and integration tests | Direct and OTA/agent UI real env not observed |
| PMS-01 | Booking transitions, TM30 and condition reports | Full authenticated staff/guest browser lifecycle not observed |
| FIN-01 | Cash/card/transfer/ledger and statement tests | Refund/commission/payout/bank reconciliation not observed |

There is a new integration test `src/modules/workflows/property-to-financial-close.integration.test.ts` covering one representative cash path and statement, but it does not complete all seven independently. CI green alone is not proof of production behavior.

## Release gates
1. Green CI on **latest head SHA**: lint, migration replay/drift, production build and all tests.
2. Vercel preview deployed; current build-rate limit requires resolution.
3. Reconcile exact production rows: Layantara 39 villas and its categories G6/G7/G8, photos, prices, booking blocks, owner links; Title Legendary, Title Serenity and Capri. Compare actual source and target, not just counts.
4. Run 7 scenarios with admin, operations, owner, guest and agent identities; capture booking/ledger/statement IDs; zero duplicate unit or booking records.
5. For channels without ARI push, explicitly enforce manual inventory hold/closeout and error escalation until connector is operational.
6. Finance sign-off includes customer receipts/refunds, deposit claim/release, agency fee, owner statement/payout and bank reconciliation.
7. No production merge based only on process cards or static architecture diagram.
