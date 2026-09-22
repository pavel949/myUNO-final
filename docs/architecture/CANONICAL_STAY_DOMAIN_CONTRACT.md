# Canonical Stay Domain Contract

Status: **CANONICAL / SSOT**  
Applies to: admin onboarding, public Stay, pricing, availability, calendar, booking, owner/operations surfaces.

## Property graph

```
Organization (org_type=developer)
  -> Project
     -> InventoryCategory
        -> Unit
        -> RatePlan
     -> Unit
        -> CommercialOffering
        -> Booking

Availability = derived(Project/Category/Unit scope, date range)
             from Booking + active holds + BlockedDate + approved external/channel blocks.
```

## Authority

| Concept | Canonical entity | Meaning |
|---|---|---|
| Developer | `Organization(org_type=developer)` | Legal/trading developer identity. No duplicate Developer master table. |
| Project | `Project` | Development/resort/building. Owns shared address, facilities, project content and project media. |
| Category | `InventoryCategory` | Canonical sellable/operational type inside a project. Owns category capacity, sleeping configuration and category-level master pricing. |
| Physical home | `Unit` | One real villa/apartment/room. Must belong to a Project and canonical InventoryCategory before go-live. |
| Sellable use | `CommercialOffering` | How a physical unit/category is offered: short stay, long stay, sale or another supported commercial mode. |
| Price contract | `RatePlan` | BAR/master or derived pricing attached to canonical category/unit scope. |
| Availability | derived service/read model | Never independently editable inventory. Computed from reservations, holds and blocks. |
| Reservation | `Booking` | One reservation lifecycle from request/hold through confirmed, stay and completion/cancellation. |
| Manual closure | `BlockedDate` | Explicit operational/owner/maintenance inventory closure. |
| Media | `ProjectMedia`, `UnitMedia` | Media stays attached to its canonical object; public views compose it, never duplicate it. |

## Invariants

1. A Unit cannot become `live` without a Project and InventoryCategory.
2. Public Stay pages read the same Project/Category/Unit graph used by admin. There is no separate public-listing master record.
3. CommercialOffering controls whether an asset is sellable/bookable; it does not duplicate property facts.
4. RatePlan is the pricing SSOT. Legacy nightly-price fields are compatibility/read-through only and must not become a second pricing engine.
5. Availability is derived. No screen may maintain its own independent availability truth.
6. Booking and BlockedDate are authoritative occupancy constraints. Active payment holds participate according to the booking service contract.
7. Every calendar scope (portfolio/project, category, unit) is a projection of the same availability engine.
8. Search results, Stay cards, Stay detail, quote and checkout must use the same canonical identifiers and pricing/availability services.
9. Publish/go-live is a gated transition, not a cosmetic status toggle.
10. Developer/Project/Category/Unit facts are entered once and inherited/composed downstream.

## Canonical onboarding UX

The admin experience follows one progressive flow:

1. **Developer** — select/create developer organization.
2. **Project** — identity, location, shared amenities, policies, project media.
3. **Inventory** — create canonical categories, then physical units.
4. **Stay content** — unit/category descriptions, sleeping, amenities and media.
5. **Commercial offering** — enable short stay (and other supported modes explicitly).
6. **Pricing** — BAR/master rate plan, seasons/rules/derived plans.
7. **Availability** — opening state, owner/maintenance blocks, channel mappings.
8. **Booking rules** — occupancy, LOS, lead time, instant/request booking, deposits/cancellation.
9. **Review** — validation report with blocking errors and warnings.
10. **Publish** — one gated action makes the offering discoverable on public Stay surfaces.

The UI must display the hierarchy explicitly: **Developer / Project / Category / Unit**, while commercial and booking configuration appears as configuration of that physical inventory rather than competing object types.

## Canonical public Stay UX

`Search -> Stay result -> Stay detail -> dates/guests -> live quote -> reserve/checkout -> Booking`

A Stay detail page composes:
- Project context and shared amenities/media;
- InventoryCategory type/capacity;
- Unit-specific facts/media where a concrete unit is exposed;
- CommercialOffering eligibility;
- RatePlan-derived quote;
- canonical Availability;
- Booking creation.

## Canonical calendar UX

One calendar engine, three scopes:
- **Project / full property**: all units grouped by InventoryCategory.
- **Category**: all units in one InventoryCategory.
- **Unit**: one physical unit.

Rows and filters may change; occupancy truth does not. Reservation bars, holds and blocks must be sourced from canonical Booking/BlockedDate/availability services. Date navigation and selected scope must be URL-addressable so views are shareable and survive refresh.

## Prohibited duplications

Do not introduce:
- a second Developer master model;
- a separate public Listing as property SSOT;
- category strings as an alternative to `inventoryCategoryId`;
- a second editable availability table/calendar truth;
- a second booking/reservation master;
- UI-local pricing calculations that bypass RatePlan/quote services;
- copied project/unit facts inside CommercialOffering.

## Migration rule

Legacy fields may remain while compatibility is required, but all new writes and UI flows target the canonical entities above. Compatibility fields are removed only after read-path and data migration verification.
