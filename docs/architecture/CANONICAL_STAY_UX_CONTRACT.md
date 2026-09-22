# Stay UX Contract

The UI mirrors the canonical data graph. Labels may be friendly, but they must not hide which object is being edited.

## Admin information architecture

**Stay inventory**
- Developers
- Projects
- Categories
- Homes (Units)

**Commercial**
- Stay offerings
- Rate plans
- Booking rules
- Channels

**Operations**
- Calendar
- Reservations
- Stay operations
- Maintenance / blocks

### Object workspace breadcrumb

`Developer / Project / Category / Home`

A Project workspace owns shared development facts and media. A Category workspace owns type-level capacity/content and master rates. A Home workspace owns only unit-specific facts, media, ownership/compliance and exceptions.

## Add property flow

Use one guided flow rather than exposing database-shaped forms:

1. Property identity — existing/new developer and project.
2. Home type — select/create InventoryCategory.
3. Home — physical Unit facts.
4. Photos & story — project/category/unit media at the correct level.
5. Offer this home — create/enable CommercialOffering.
6. Price — select/create canonical RatePlan.
7. Availability — initial opening plus explicit blocks/channel mapping.
8. Booking rules — guests, LOS, lead time, booking mode, deposit/cancellation.
9. Review — readiness report.
10. Publish.

Every step saves a draft. Leaving and returning resumes the same canonical objects.

## Public Stay

The guest should not see internal model complexity. Public vocabulary:
- Project -> property/resort/condominium context
- InventoryCategory -> home type
- Unit -> home
- CommercialOffering -> invisible eligibility/configuration
- RatePlan -> price
- Availability -> dates
- Booking -> reservation

Public journey:
`Home -> Search -> Results -> Stay detail -> Date/guest selection -> Quote -> Reserve -> Confirmation`.

## Calendar

The calendar header always exposes scope controls in this order:
`Property | Category | Home`.

Changing scope changes rows, not availability semantics. URL keeps `projectId`, `categoryId`, `unitId`, start date and range when applicable.

Visual states:
- confirmed reservation;
- active hold;
- owner block;
- maintenance block;
- external/channel block;
- available.

No separate calendar screen may calculate occupancy from different tables or status rules.
