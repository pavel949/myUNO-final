# Supplier listing and management journeys — 2026-10-02

Founder decision: owners and authorized management companies may submit rental listings and configure their verified supply. myUNO remains the guest-facing booking/support contact. Listing distribution does not claim full myUNO property management. Actual on-site responsibility and contractual booking/payment responsibilities remain explicit and require verification.

## Public routes

- Rent: `/search` with stay dates, party, location, type, bedrooms and budget.
- Buy: `/homes?intent=buy` with location/project, type, minimum bedrooms and purchase budget.
- List property: `/rent-out` → `/property/onboard` with rental offers; applicant selects owner or management-company servicing relationship.
- Management: `/manage` → existing owner lead form; no management-company registration funnel in the management CTA.
- Sell: `/sell` / sale-prefilled property onboarding.
- Account: `/property/listings`; resume private applications or open permitted canonical unit settings.

Location is the primary discovery field. Projects are a separate searchable chip selector. Selecting a project clears the location filter; selecting a location clears the project so conflicting scopes cannot silently produce empty results.

## Configuration and authorization

No parallel property, booking, pricing, media or availability entities. Applications remain existing CRM submissions. New draft units inherit validated proposed rental terms on admin conversion; THB is converted to integer satang once, and neither submission nor conversion activates publication/bookings.

Existing canonical Unit editor, UnitMedia gallery, PricingRule and BlockedDate writers are reused. Owner write delegation is an explicit exception to the legacy read-only owner matrix: exact current unit ownership, active unit-scoped owner assignment, exactly one active owner_direct engagement, valid effective dates, no external source mapping and a unit not offboarded. A myUNO-managed owner cannot use this exception. MC access uses the existing organization/engagement guard. Self-listing owners cannot change publication, ownership, compliance, commercial authority or shared project content. No roles are granted by application submission.

## Evidence

Production TypeScript and focused automated checks recorded with this change. Local database-backed permission/booking integration reruns and real Android/deployed preview verification are pending, not claimed. No database schema/migration changes. Content seed additions do not mean production content rows have been updated.
