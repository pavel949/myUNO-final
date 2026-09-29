# PRD — myUNO Integrated Phuket Property, Hospitality & Services Platform

**Status:** implementation PRD and assessment extension; subordinate to PROJECT.md and docs/canonical/.  
**Baseline:** main 4a8ed81b24aee51020486fc049e9ef0af329ffd8, 2026-09-29. Re-evaluate at each new HEAD.  
**Users:** guests, tenants, buyers, owners, managers, frontline staff, agents, providers, myUNO control plane.  
**Pilot:** Layantara plus existing directly managed Phuket villas/condominiums. Partner supply is independent, not silently converted into myUNO-managed stock.

## 1. Problem and measurable user outcomes

A shared property model alone does not constitute a one-stop-shop. Customers need a consistent relationship across stay/rent/buy/services; owners need actual asset operations and finances; staff need a single next-action view; independent partners need truthful distribution, scoped access and a governed fulfillment handoff.

Success means:
- A new resort/category/unit/condo can be onboarded without new schema, application fork or hard-coded project UI.
- One physical unit supports short stay, long stay and sale through separate eligible offerings and shared capacity; no double-booking or cross-mode false activation.
- A guest can discover a real property, receive an authoritative quote, book/request, receive pre-arrival and stay support, add services and complete checkout within one account.
- A buyer/tenant/owner maintains one Party relationship but legal ownership is established only by actual evidence, not CRM status.
- A standalone Phuket service order works without a fabricated stay/project and has a responsible provider, accepted terms, fulfillment, complaint and settlement.
- myUNO Managed means an active evidenced operating mandate; Verified Partner Managed means an evidenced independent operator. Neither badge is an empty marketing toggle.
- Operators can reconstruct each transaction, booking, service, payment, owner allocation and integration recovery from canonical records.
- Users only see permitted assets and actions, including in search, media, server-rendered views and exports.

## 2. Design constraints

1. Reuse the existing modular Next.js 14 / React 18 / Prisma / Supabase / PostgreSQL application; it is **not** a Vite greenfield build.
2. PROJECT.md and canonical CO01–CO30 passports take precedence. New PRD requirements must be reconciled to existing code and any changed canonical decision recorded.
3. Preserve the current Booking, ServiceOrder, CRM, Property and Finance writers where correct. A cross-domain order *reference/orchestrator* may connect them; do not replace each domain's invariant with one generic mutable order entity.
4. Project Spaces have independent branding/content/operations and public URLs, but shared identity, catalog, financial and integrity rules; a separate DB requires a documented exception.
5. Separate legal tenant (organization), project operating scope and physical asset; overlapping exclusive authority is a conflict.
6. No false images, imported bookings, guaranteed yields, pricing, compliance, verified status or provider capacity.
7. Expensive release work remains staged until source reconciliation and deployment/runbook approval.

## 3. Product scope and actor jobs

| Surface | Primary job | Source and state |
|---|---|---|
| Global public marketplace | Discover Stay, Rent, Buy and Services with transparent operating status | Published allowlisted search projection, fresh quote |
| Project Space | Branded resort/development view with actual categories, units, amenities and policies | One project identity; config not app fork |
| Unit detail | Actual/representative media, physical facts and eligible offers | Canonical physical unit + offerings |
| Guest My Trips / Home Space | Manage travel, pay, check in, order services, report issues | Canonical Booking + derived trip context |
| Owner My Homes | See bookings, statements, maintenance, approvals, owner stays | Effective ownership + mandate and ledger |
| Manager Today / Calendar | Availability, arrivals, operations, team, rates, cases | Canonical Booking/Inventory, role scoped |
| Sales / Lease workspace | Manage offer, viewing, agreement, milestone, handover | CRM handoff to typed transaction; ownership not inferred |
| Provider My Orders | Accept/reject, fulfill, evidence, exception and earnings | Provider/Service/ServiceOrder/Finance |
| Platform Control Plane | Needs Attention, verification, quality, settlement, system health | Audited cross-project authorized projections |

No universal navigation exposing unrelated business modules to every role. Onboarding and pricing use progressive disclosure and direct links from completion blockers.

## 4. Canonical graph and commercial lifecycle

Existing candidates: Project, Unit, InventoryCategory, CommercialOffering, RatePlan, PricingRule, Booking, OwnershipPeriod, UnitEngagement, ManagementContract, ProjectOrganizationRole, CrmOpportunity, ServiceOrder, Payment, LedgerEntry, Payout and ExternalEventInbox. Do not create duplicate tables unless gap is proven.

Target graph:
Organization / operating authority → Portfolio (management grouping) → Project/Development → optional Building/Zone → InventoryCategory → physical Unit → CommercialOffering (short_stay, long_stay, sale) → typed transaction.
A standalone villa may have a single-unit project without artificial operational complexity. A resort category has representative photos, rate defaults and allocatable real units. Physical identity, legal owner and exclusive authority remain independent.

Shared commercial orchestration: Party + intent/source → proposal/quote version → typed acceptance (Booking, Lease, SaleTransaction, ServiceOrder) → payment obligations → fulfillment/domain events → settlement + CRM linkage. This is a relationship/reference layer, not a new source of truth for domain status. Package/component transactions preserve independent terms and refunds.

## 5. Progressive onboarding and media

1. Select: independent villa, resort/hotel, condominium/block, or portfolio; choose or create existing Project.
2. Facts: location, structure, areas, floors, capacity, category vs exact unit, amenities, beds, equipment.
3. Ownership/authority: effective owner, legal entity, signed authority, delegated team, payout terms.
4. Content: project / category / actual-unit galleries with rights/provenance, EN/RU/TH, drag order, selected cover. Representative images must be labelled and never substitute for exact-unit proof where required.
5. Offers: select Stay, Long Stay and/or Sale; hide irrelevant fields; offering-specific permitted-use/compliance.
6. Pricing: simple base → optional seasons → advanced date, unit and channel adjustments → preview resolved quote; version accepted terms.
7. Operations: check-in, services, building policy, TM30 responsibility, staff, channel sync and contacts.
8. Review: autosaved draft, blockers/warnings, permitted capability gates and public preview; no generic “live” bit that activates an unsupported commercial mode.

Validation must be server authoritative; include per-offering canPublish/canReceiveInquiry/canRequestBooking/canInstantBook/canOperate/canSettle.

## 6. Revenue, booking, lease and sales

- One authoritative price calculator resolves applicable base/category/unit/date/season/length/channel policies. It stores a booking or order snapshot of taxes, fees, deposit, utilities, currency conversion and cancellation/payment terms.
- One physical availability ledger applies reservation/hold, owner stay, external block, maintenance and alternately sold configurations. DB transaction/exclusion/idempotency defends real booking writes.
- A Lease workflow requires application, parties, signed agreement, rent/deposit schedule, effective occupancy, amendments/termination, and operational block. Do not describe CRM “won” as an executed lease.
- A Sale workflow requires seller authority, buyer enquiry, viewing, offer, deposit/milestones, diligence documents, transaction status and actual transfer evidence. Sale does not establish legal ownership before evidence.
- Booking → pre-arrival → access eligibility → check-in → in-house → issue/extension → checkout → inspection/refund → post-stay is one lifecycle with role-specific presentations.

## 7. Concierge/service fulfillment

Reuse Provider/Service/ServiceProject/ServiceOrder/ServiceQuoteVersion and Finance. Required cases: stay-linked transfer, villa groceries, owner repair/cleaning, and standalone area/address service. Distinguish amount, participants, duration, item quantity and scarce resource capacity. Order exposes commercial, payment, fulfillment, dispute and settlement states separately. Every order has provider and/or responsible fulfillment owner, real terms, SLA, exception, acceptance proof and financial allocation. Service ticket without commercial terms must not automatically become an order. No “confirmed” status from a queued partner request.

## 8. Trust, tenant security and accountability

Verification workflow: draft → submit → identify operator/asset/authority → documents/expiry/review → approved → capability-specific activation → ongoing monitoring/suspension. Store evidence and reviewer; management badge resolves from current effective signed mandate, not use of the software. Partner badge discloses independent operator, who controls pricing, fulfillment and recourse.

Security: server-side identity + role assignment + org/project/unit resource + effective authority + action/state; test IDOR across owner, provider, staff, partner and guest API/SSR/media/export/search. Private access and regulatory documents are separate from marketing images.

## 9. Phuket-specific operational readiness

Require per-unit permitted-use and building/juristic rules, applicable accommodation permissions, accountable TM30/reporting task, access/key procedure, actual local service coverage and provider capability. Commercial modes and OTA channels remain disabled when evidence is missing or authority conflicts. Review by qualified local professionals where required; code flags evidence, not legal conclusions.

Layantara cutover is a signed separate workstream: 39 physical villas, 8 category definitions, source crosswalk, actual gallery-byte provenance, mathematical tariff parity, approved offerings, booking/blocks/owner/staff/compliance reconciliation, source authority, migration, runtime, rollback. A static resource import is not a booking or financial cutover.

## 10. Delivery slices (do not duplicate draft PR work)

| Slice | Build after audit | Exit proof |
|---|---|---|
| S0 Evidence | Automated inventory + flow/surface/writer matrix | Current branch/main/deploy evidence with explicit unknowns |
| S1 Core integrity | Fix confirmed authority, inventory, quote, money or tenant violations | P0 AT tests + DB constraints |
| S2 Unified property UX | Onboarding/capability gates/category/unit media and Project Space | Real property without code changes; photo provenance |
| S3 Stay operations | Single calendar and booking lifecycle; arrivals/tasks/owner surfaces | CO07–CO12/15–16 and owner isolation |
| S4 Concierge orchestration | Standalone/stay service order → provider → proof → settlement | CO14/17/23 + AT01–AT15 |
| S5 Lease/sales transaction | Typed legal/commercial milestones and CRM handoff | CO02/26/27; no false ownership |
| S6 Distribution and trust | Source/partner readiness, verification, ARI/recovery | CO25/29 + source failure safety |
| S7 Release | Migration/reconciliation, CI, live device/role smoke, restore | AT16–AT30, signed staged activation |

Inspect PR #144 (unified draft), #142 (media) and #143 (quote/readiness) before coding S2/S3; do not cherry-pick blindly or claim them deployed.

## 11. Acceptance, diagnostics and decisions

Run docs/audits/AI_FULL_PLATFORM_AUDIT.md, AI_FLOW_SURFACE_MATRIX.md, AI_AUDIT_REPORT_TEMPLATE.md and generated inventory for every major phase. Report all nine readiness dimensions, CO01–CO30, AT01–AT30, exact commit/deploy, real data and negative paths. A green compile alone is not acceptance.

Commercial decisions that require explicit authorization: management responsibility and fee schedules, property licences/use, payout/collector roles, live tariff/tax tables, owner priority waterfall, partner commitments, and activation of unverified inventory. Build reversible configuration but keep uncertain capabilities disabled.

## 12. Out of scope for this document

Do not invent a new database per ordinary project, rewrite legacy transaction history, publish unsupported investment returns, bypass legal/OTA restrictions, fabricate supplier availability, make a brand badge a substitute for operating authority, or mark production ready based on static file existence.
