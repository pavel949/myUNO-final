# myUNO Design-System Gap Closure Audit — 2026-10-01

Source benchmark: uploaded “App design system project” package, latest supplied version `(5)`, covering Design System, Home v2, Wireframes, Key Screens, Flows, Portals and Data Model.

## Design principles adopted

myUNO keeps its own brand tokens and canonical entities. The benchmark is used for interface architecture, conversion hierarchy, role/workspace patterns and flow completeness — not for IQI-specific brand, claims, data products or terminology.

Adopted rules:
- One dominant CTA per screen/section.
- Five status tones: done, active, waiting, blocked, neutral.
- Record headers separate identity, status, actions and tabs.
- Process steppers show the current operational state.
- KPI tiles show metric + comparison + computation context.
- Money lines separate amount, label and regime/source context.
- Source chips are used where claims need provenance.
- Sticky CTA bars on mobile transaction screens.
- Empty states explain what is missing and the next valid action.
- Public navigation is intent-led.
- Canonical entity hierarchy remains Project → Category → Unit → CommercialOffering → Quote/Booking/Deal → Operations/Finance.

## Surface parity

### Public marketplace

| Benchmark surface | myUNO state |
|---|---|
| Home | Present; redesigned on premium conversion sequence |
| Stay search | Present `/search` |
| Stay detail / checkout | Present `/units/[id]` → `/book/review` → `/checkout/[sessionId]` |
| Project page | Present `/projects/[slug]` |
| Complex portal | Covered by canonical Project page, not duplicated |
| Buy search | Present `/homes?intent=buy` |
| Long-term rent | Present `/homes?intent=rent` |
| Sell / valuation intake | Added `/sell` |
| Area page | Added `/areas` and `/areas/[slug]` using canonical Area hierarchy |
| Services marketplace | Present `/services` and `/services/[id]` |
| Owner entry | Present `/owners` |
| Developer entry | Present `/developers` |
| Management-company entry | Present `/management-companies` |
| Trust / method | Present `/trust` |
| Help / support | Covered by tickets, messages and guest surfaces; no separate public Help Center yet |

### Client / account modes

| Benchmark mode | myUNO mapping |
|---|---|
| Guest | `/trips` and booking Home Space |
| Buyer | `/buying` |
| Owner | `/owner` and `/owner/units/[unitId]` |
| Resident | `/residence` |
| Tenant | Resident/buyer/rental context; no separate tenant shell |
| Seller | Owner → `/sell`; no separate seller dashboard |
| Investor | Buyer/owner contexts; no separate investor portfolio mode |

myUNO intentionally avoids separate copies of the same physical home for buyer, seller, tenant and owner modes.

### Stay pass

Benchmark before-arrival / check-in / during-stay / after-checkout states map to:
- `/bookings/[bookingId]/home-space`
- `/bookings/[bookingId]/passports`
- handbook / requests / services / tickets
- `/trips/[id]`

The data model and operational flows exist; visual convergence to one shared Stay Pass shell remains a later component-level polish item.

### Operations

Existing myUNO coverage:
- Today / operations board `/ops`
- Unified calendar `/ops/calendar/board`
- Stay operations `/ops/stays`
- Booking requests `/ops/requests`
- TM30 `/ops/tm30`
- Unit records / editing `/ops/units/[unitId]`
- Mobilization `/ops/mobilization`
- Project facts / editing `/ops/projects/[id]/edit`
- Costs and claims
- Project team
- Admin CRM pipeline
- Finance / ledger / payouts / reconciliation
- Provider marketplace operations
- Content administration
- Compliance and audit

The benchmark’s “Ops Console” is therefore mostly a navigation and component-consistency target rather than a missing system.

## Shared interface gaps closed in this branch

Added canonical reusable premium primitives:
- `RecordPageHeader`
- `StatusChip`
- `ProcessStepper`
- `KpiTile`
- `MoneyLine`
- `SourceChip`
- `StandardFilterBar`
- `InboxItem`
- `CtaBar`
- `EmptyState`

These use existing myUNO colors, typography, radii, spacing and motion rules.

## Homepage gaps closed

New sequence:
1. Hero + commercial search.
2. Compact intent chooser: Stay / Monthly / Buy / Sell.
3. Featured canonical projects.
4. Canonically eligible homes.
5. Connected-platform proposition.
6. Services marketplace.
7. Owner / developer-manager conversion.
8. Trust.
9. Final property/service CTA.

Removed as primary homepage concepts:
- generic destination cards without canonical Area records,
- repeated ecosystem explanation,
- oversized guided-discovery section.

Area discovery now has dedicated canonical routes.

## Deliberately not copied from the IQI benchmark

These are separate business capabilities, not safe design-only substitutions:

### “Project Passport”
myUNO has ClearView methodology, regulatory credentials, compliance records and project/unit readiness. It does not yet have a canonical public versioned `ProjectPassport` aggregate with:
- fixed domain/check schema,
- immutable published versions,
- second-reviewer independence rules,
- public named gaps,
- developer right-of-reply,
- next review date.

Do not label projects “Passport Pass/Conditional/Fail” until that aggregate exists.

### Market Truth / Property Index
myUNO has internal metrics and property/operations data but no governed public research publication workflow with source-by-number, independent second check, release calendar and correction log. Do not publish market figures as a design-only feature.

### Video Library
Current `MediaAssetKind` has no video type. A real video library requires:
- canonical video media type / storage,
- transcoding or supported playback source,
- project/unit/area relationships,
- language/subtitle metadata,
- recorded date and provenance,
- public visibility gate.

### Agent / developer partner portal
myUNO has booking channel `agent`, CRM, organizations and attribution foundations but no first-class scoped `agent_member` / developer-partner role and no organization-scoped commission pipeline. Building only a dashboard shell would create false capability. This remains a product/data-model gap, not a visual one.

### Public map discovery
Area hierarchy and coordinates exist. A reusable public map/list discovery surface still requires the map provider integration and map/search synchronization contract. Do not create a decorative map that is disconnected from canonical search.

## Remaining gaps by priority

### P0 — before claiming full benchmark parity
1. First-class partner/agent organization role and scoped partner pipeline.
2. Public list/map search tied to canonical Area, Project and Unit records.
3. Public verification aggregate if “Passport”-style trust is desired.
4. Unified Stay Pass visual shell across pre-arrival, in-stay and post-stay.

### P1
1. Dedicated seller dashboard projection from Owner + CRM opportunity.
2. Investor portfolio projection from existing owner/buyer/finance records.
3. Public Help Center information architecture.
4. Standard premium primitives rolled across every ops/admin/owner/provider screen.

### P2 / optional
1. Governed public research/index publication system.
2. Video library.
3. Country-desk localization model.

## Integrity rules

- No benchmark text, price, yield, licence, verification result or status is copied into myUNO without authoritative data.
- No duplicate Project, Unit, Offering, Booking, CRM or Finance entity is introduced for presentation.
- Editorial ranking may control presentation order only.
- Transactional eligibility remains canonical and fail-closed.
- Existing design tokens remain authoritative.
