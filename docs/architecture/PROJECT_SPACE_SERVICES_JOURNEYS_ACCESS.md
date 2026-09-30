# Project Space + myUNO Services — user journeys, roles and access

Date: 2026-09-30
Scope: canonical Project Space, stay inventory, service marketplace, guest context and project operations.
This document describes the implemented target paths in PR #160. It is not a production sign-off.

## Canonical model

Project Space is a projection of existing sources of truth; it is not a second CMS or booking system.

- `Project`: development/resort/condominium/hotel identity, description, area, facilities, gallery, handbook and lifecycle.
- `Area`: reusable locality content shared by projects in the same district/area.
- `InventoryCategory`: accommodation type/class inside the project.
- `Unit`: exact physical villa/condo/room.
- `CommercialOffering`, `RatePlan`, `PricingRule`, `BlockedDate`, `Booking`: canonical stay commerce/availability.
- `Service`: one marketplace product supplied by one provider.
- `ServiceProject`: optional project scope and project commercial terms for a Service.
- `ServiceOrder`: immutable project/unit/booking/order snapshot.
- `Provider`: vetted fulfilment organization.
- `MediaAsset`: one media authority reused by project/category/unit/service gallery relations.
- `ContentKey/Translation`: editable translated project editorial.
- `RoleAssignment`, `ProjectStaffPermission`, management engagements: resource authorization.

A Service with zero `ServiceProject` rows is global. Once it has project rows, it is restricted to those projects. A matching project row can additionally control `enabled`, `public`, project price override, lead time, take rate, SLA and versioned terms.

## Public discovery journey

1. Visitor opens `/projects/[slug]`.
2. Only a live Project is returned by the public project read model.
3. The page reads project gallery, translated editorial, shared Area copy, facilities/amenities, categories and live/sellable Units.
4. Availability search sends the canonical Project ID into Stay Search.
5. Category cards describe an `InventoryCategory`; unit cards link to exact physical `Unit` records.
6. The project service section calls the same canonical Service/Provider catalogue as `/services`, filtered by Project ID.
7. Service links preserve Project ID; deep links are rejected if a restricted service is not public/available for that project.
8. A visitor may browse public services without authentication. Ordering requires authentication plus a valid booking or project/unit-scoped role.

## Guest booking → stay → services journey

1. Guest searches Project → category/unit → dates.
2. Canonical pricing/availability produces the quote; Booking is created from the same Unit/Project graph.
3. Confirmed booking appears in Trips/Home Space.
4. A signed-in guest opening the same Project Space is matched to a future/current `confirmed` or `checked_in` booking for that Project.
5. Project Space passes `projectId + bookingId + unitId` into Services.
6. `/services` filters the catalogue by project and preserves the stay context through category selection and service detail.
7. Service detail resolves the same project-specific price and lead time as the order engine.
8. `POST /api/service-orders` validates booking ownership, Project/Unit consistency and service eligibility.
9. The domain service ignores caller-supplied totals, resolves the project offer, computes the order total, snapshots take rate/terms and creates ServiceOrder.
10. Provider members receive the order; guest sees it in My Orders/Home Space.
11. Payment, provider acceptance, fulfilment, cancellation/refund and review use the existing canonical ServiceOrder lifecycle.

## Resident journey

1. Active `resident` RoleAssignment scopes the person to their Project or Unit.
2. Residence portal shows only that Project, its announcements and the same project-filtered services.
3. Resident can browse/order services within their scoped Project/Unit.
4. Resident cannot edit Project content, inventory, provider configuration or project marketplace scope.

## Owner journey

1. Owner enters Owner Hub and sees only owned Units.
2. Owner may inspect availability/pricing and own-unit booking data according to permission scope.
3. Owner may place owner stays and order marketplace services for their own unit.
4. Owner may submit/update property information through the controlled onboarding path, but cannot publish the Project or alter platform service scope.
5. Sensitive operational instructions remain outside public Project Space.

## Management-company journey

1. `mc_member` receives explicit project/org role plus an active matching management engagement.
2. MC Portfolio shows only authorized managed Units and their Category + exact Unit identity.
3. MC can operate availability/pricing, reservation requests, tickets and service orders for those units within its project scope.
4. MC cannot change platform provider vetting or Project Service catalogue configuration.
5. MC cannot publish/unpublish the Project itself.

## Project operations/staff journey

1. Project staff obtains explicit department permissions.
2. Stay/Calendar/Pricing surfaces use canonical Booking/BlockedDate/Pricing data.
3. Staff can perform assigned operational work, check-in/out, requests, pricing and unit maintenance within project scope.
4. Project-level service catalogue commercial configuration remains platform-admin controlled.
5. Staff may order services operationally only in a valid project/unit context.

## Provider journey

1. Provider application → admin vetting → active Provider.
2. Provider creates/maintains its own Service records according to provider permissions.
3. Admin approval determines whether a service becomes active.
4. Provider receives only orders belonging to its Provider.
5. Provider may accept/decline/fulfil those orders and reply to reviews.
6. Provider cannot alter another provider, a Project, Unit inventory, or ServiceProject scope unless platform admin performs that action.

## Platform-admin / Project Space management journey

From Project 360:

- Project facts / physical structure.
- Project gallery/media editor.
- Private Project Portal preview.
- Project service catalogue manager.
- Project onboarding/readiness and eventual publish gate.
- Canonical categories and RatePlans.

Project service manager rules:

- Global service: already available to every Project.
- Restricted service elsewhere: admin may add the current Project.
- Restricted service here: admin may enable/disable, show/hide publicly and edit project price/lead time/take rate.
- Removing the final project restriction is blocked because it would silently make the service global.
- `Make global` is a separate explicit action.
- Every scope mutation is audit-logged.
- Project price is entered in THB and stored in integer satang.
- Project terms version increments on commercial edits.

## Access matrix

| Capability | Public | Guest | Resident | Owner | MC | Project staff | Provider | Platform admin |
|---|---|---|---|---|---|---|---|---|
| View live Project Space | yes | yes | yes | yes | yes | yes | yes | yes |
| Browse project services | yes | yes | yes | yes | yes | yes | yes | yes |
| Order service | no | own validated stay/context | scoped project/unit | scoped own unit | scoped managed unit | scoped project/unit | as a person in valid context | yes |
| View/manage own service orders | no | own | own | own | own/scoped ops | scoped ops | provider fulfilment side | yes |
| Edit exact unit listing | no | no | no | read own | managed units | scoped operations | no | yes |
| Manage availability/pricing | no | no | no | read own | managed units | scoped operations | no | yes |
| Edit Project content/publish | no | no | no | no | no | no | no | yes |
| Manage Project Service catalogue | no | no | no | no | no | no | no | yes |
| Vet providers/services | no | no | no | no | no | no | own submission only | yes |
| Access provider orders | no | no | no | no | no | operational views only | own provider only | yes |
| View sensitive access instructions | no | own allowed surfaces only | no | own operational scope only | scoped operational need | scoped operational need | no | yes |

## Security invariants

- Public Project Space never reads encrypted Unit access instructions.
- Project ID is context, not authorization.
- Booking context is accepted only when the booking belongs to the caller and Project/Unit match.
- Without booking ownership, service order placement requires an active role scoped to the Project/Unit.
- Public service detail cannot bypass ServiceProject restrictions by direct URL.
- Project-specific price/lead time displayed to the user is resolved by the same offer resolver used when creating ServiceOrder.
- Caller-submitted totals/take rate/price breakdown never become authoritative.
- A disabled/private/expired project-service row cannot appear as a public project offer.
- Provider vetting and active status are required for public marketplace exposure.
- Draft Project/Unit supply stays out of public Stay discovery.

## Reuse for Legendary / Serenity / future complexes

No code fork is required. A new Project receives:
1. Project facts, Area and editorial.
2. Project/category/unit media.
3. InventoryCategory → Unit hierarchy.
4. Commercial offerings/rates/availability.
5. Global myUNO services automatically.
6. Optional ServiceProject restrictions/overrides.
7. Public Project Space and private admin preview.
8. Owner/MC/resident/staff roles scoped to the same Project ID.

Layantara is therefore the first populated example of the same reusable Project Space contract, not a separate application model.
