# Stitch UI / myUNO-final flow reconciliation

Date: 2026-10-05

## Reference files

The screens now live in the repository: `docs/design/stitch/` (52 screens, index in its README). The scope note below describes the earlier two-screen pass and is superseded for scope — the full set includes owner onboarding, PMS (front desk, tape chart, maintenance, night audit), vendor/agent hubs, superadmin, checkout, mobile and the two long-term-living screens. The adoption rules below still apply: reference for hierarchy and flow, not for business claims.

## Attachment scope note (2026-10-05)

The Stitch attachment available in this implementation pass contains exactly two rendered sources: `myuno_long_term_living_1` and `myuno_long_term_living_2`. Therefore the evidence-backed design comparison in this pass is limited to the long-term living catalogue/search/detail composition. Broader operational rows below come from the existing myUNO architecture audit and must not be read as flows proven by this specific attachment.

For the two attached screens, the supported design takeaways are:
- a compact lease-first filter deck;
- horizontal residence result cards;
- lease/deposit/availability facts visible before opening a residence;
- a contextual right rail;
- clear separation of discovery, residence detail and enquiry actions.

The following visible Stitch claims are **not adopted without canonical evidence**: escrow guarantees, blanket 24/7 legal support, universal agency-licence claims, no-markup claims, and synthetic first-payment totals.

## Purpose

The Stitch package is a design and flow reference, not a replacement data model. Existing canonical myUNO business rules, authority gates, pricing, availability, media readiness, RBAC and audit boundaries remain authoritative.

The Stitch package is stronger where it makes operational state, action hierarchy and multi-step flows visible. The current homepage strategy remains stronger where it defines commercial truth, responsibility, destination scaling and cross-surface search context.

## Design patterns to adopt

1. **Operational left rail** for PMS, owner, agent, vendor and superadmin workspaces.
2. **Compact KPI band** at the top of operational dashboards before dense tables.
3. **Primary workspace + contextual right rail** for booking, folio, unit, owner and work-order detail.
4. **Explicit state chips** for readiness, payment, housekeeping, maintenance, authority and publication states.
5. **Step-based wizards** for onboarding/check-in rather than long mixed forms.
6. **Sticky mobile CTA** for public booking/service flows.
7. **Dense but legible tables** for PMS/finance with quick filters and saved context.
8. **One surface = one operational question**; avoid combining setup, audit and execution in one page.

## Flow matrix

| Stitch flow | Current myUNO-final | Status | Resolution |
|---|---|---|---|
| Consumer homepage | `/` | Present | Keep canonical homepage strategy; borrow visual hierarchy/mobile patterns |
| Long-term living | `/homes?intent=rent`, `/homes/[id]` | Present, being expanded | Add move-in, term, pets, lease facts and context continuity |
| Project portal | `/projects/[slug]` and subroutes | Present | Adopt clearer portal section hierarchy and sticky mobile actions |
| Unit detail / booking checkout | `/units/[id]`, `/book/review`, `/checkout/[sessionId]` | Present | Consolidate visual flow; preserve quote/availability engine |
| Service marketplace/detail | `/services`, `/services/[id]` | Present | Adopt Stitch service-detail booking composition |
| HomeSpace | `/bookings/[bookingId]/home-space` | Present | Adopt dashboard/card hierarchy where compatible |
| Owner portal P&L | `/owner`, statements and unit pages | Present | Adopt clearer KPI + booking calendar + transaction composition |
| Owner onboarding | `/property/onboard` + admin onboarding | Present | Adopt stepper/progress visual language; keep canonical readiness gates |
| Project/resort onboarding | admin project/property surfaces | Partial | Consolidate into a guided project setup flow without duplicating canonical facts |
| Front desk arrivals/departures | `/ops/stays`, `/ops/reservations` | Partial | Recompose as Front Desk workspace using existing booking/check-in APIs |
| Check-in wizard | booking/passport/access flows | Partial | Build one guided check-in surface over existing operations |
| Tape chart | `/ops/calendar`, `/ops/calendar/board`, MC calendar | Partial | Use Stitch tape-chart visual grammar on canonical calendar/inventory engine |
| Housekeeping dispatch | `/ops/housekeeping`, `/ops/tasks` | Present | Adopt Stitch dispatch/detail split |
| Maintenance work orders | `/ops/maintenance`, operational tasks | Partial | Recompose into work-order queue + detail; do not create duplicate maintenance ledger |
| Guest folio | stay/booking/finance surfaces | Partial | Add consolidated folio view from canonical payment/refund/service ledgers |
| Night Audit / daily reconciliation | no first-class route | **Missing** | Flagged. Requires explicit business close-day contract before implementation |
| Agent Hub | no dedicated route on main | **Missing on main** | Flagged. Existing draft PR #189 contains agent workspace work; reconcile separately |
| Vendor Hub | provider portal exists but no Stitch-equivalent order command center | Partial | Recompose provider surface; missing full vendor operations hub |
| Live service tracking | service order surfaces | Partial | Requires state timeline/ETA contract before claiming live tracking |
| Superadmin destination expansion | config/areas/admin surfaces | Partial | Consolidate destination settings; preserve jurisdiction boundaries |
| Superadmin portfolio/projects | admin projects/units | Present but fragmented | Adopt executive hierarchy and portfolio summary |
| Superadmin services/vendor accreditation | providers/services admin | Present but fragmented | Consolidate into one service supply control surface |
| Superadmin ledger/splits/payouts | ledger/payout/reconciliation pages | Present but fragmented | Adopt Stitch financial workspace layout, keep immutable ledger logic |
| Superadmin IAM/RBAC/audit | people/roles/audit surfaces | Partial | Missing consolidated IAM/RBAC matrix surface |
| API/cloud cluster control | integrations/config exist | Partial | Do not invent infrastructure controls not backed by Vercel/Supabase integrations |
| AI web/file/OTA import | no canonical end-to-end route | **Missing** | Flagged. Needs ingestion provenance, validation and media rights workflow first |
| Culture/manifesto strategy hub | no product requirement | Out of core | Keep as internal content only if useful; not operational priority |
| ROI marketing surface | buying/sales surfaces | Partial | Must obey evidence/no-guaranteed-return rules; Stitch claims require data proof |

## Missing-flow rules

A Stitch screen is not considered implemented because a visually similar page exists. A flow is only complete when:
- its initiating action is reachable;
- canonical data exists for every displayed state;
- permissions are enforced;
- negative/error states exist;
- server-side business transitions are implemented;
- downstream finance/CRM/operations effects are connected;
- mobile and desktop paths preserve context.

## Priority derived from reconciliation

### P0 — integrate into active homepage work
- Long-term living search and detail
- Header IA
- Project responsibility scope
- Managed placements
- Analytics instrumentation
- TH/ZH localization

### P1 — surface consolidation on existing engines
- Front Desk + guided check-in
- Tape chart/calendar
- Maintenance/work orders
- Owner portal
- Provider/vendor operations
- Superadmin portfolio / services / finance / IAM

### P2 — new capability contracts required
- Night Audit
- AI file/OTA ingestion
- Live service tracking
- Cloud cluster/API operations beyond current integrations

## Design verdict

The Stitch package is **clearer and more comprehensive as a surface map**, especially for operations. It is not more complete as a business-system specification: several screens imply workflows or claims that the current canonical system does not yet support. myUNO should therefore use Stitch for visual hierarchy and flow composition while retaining the current canonical business model, authority gates, pricing truth and audit rules.
