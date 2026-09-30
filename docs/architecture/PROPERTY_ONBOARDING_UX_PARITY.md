# Property onboarding: Airbnb-like experience, canonical myUNO records

Status: implementation contract; audit of current main on 2026-09-30. Do not treat a specification as deployed functionality.

## Existing evidence
- Public project portal: `src/app/(public)/projects/[slug]/page.tsx`; public project list: `src/app/(public)/projects/page.tsx`.
- Project gallery: `Project.galleryMedia`, `src/app/api/admin/projects/[id]/media/route.ts`; unit gallery: `src/app/api/admin/units/[id]/media/route.ts`. Both admin-only, with ordered media and explicit covers.
- Admin project creation: `src/app/(admin)/app/admin/properties/new/new-property-client.tsx`.
- Admin ten-section onboarding: `src/app/(admin)/app/admin/properties/[id]/onboarding/property-onboarding-client.tsx`.
- Readiness: `src/modules/projects/property-readiness.ts`.
- Owner marketing page `/owners` presently leads to a lead form, not a verified owner self-listing writer. Do not link owners directly to admin-only APIs.

## Canonical invariant
One physical Project → optional InventoryCategory → one physical Unit, linked to an owner and time-scoped authority. One unit can have short stay, monthly/long-term rental, sale and owner-use configurations without duplicating the physical record, booking capacity, galleries or historic financial facts. Project media describes shared spaces; category media describes the representative type; unit media describes the actual home. Never silently represent shared category photos as photos of a specific unit.

## Entry points
1. Admin: add project, add home to existing project, edit and approve submissions.
2. Verified owner: My Homes → Add a home → search existing project → add one unit as draft → submit for review. Existing unit claim requires evidence and staff verification, never silently reallocates ownership.
3. Property manager: My Portfolio → Add property / add home; select organization and mandate scope; draft only until authority verified.
4. New complex: propose a project draft, deduplicate by name/address/geo/identifiers, review before use in public. Never create duplicate projects for each owner in a condominium.

## Guided user journey
1. Choose what you are adding (home in existing residence; standalone home; entire residence/resort).
2. Find your residence (search name/address/map). Show existing project photo, address and amenities; offer "My building isn't listed" only after search.
3. Your home (unit/floor/building/area/bedrooms/bathrooms/occupancy, access privately).
4. Tell its story (title, description, property-specific amenities and sleeping spaces).
5. Photos (multiple upload, reorder, cover, captions and scope; public preview; no invented images).
6. Relationship (owner claim, representative authority, company, supporting private documentation and invitation).
7. How to offer it (short stay/monthly/yearly/sale, separate terms and legal gates).
8. Pricing and availability (canonical rate plans, fees/deposits, calendar, restrictions; no duplicate pricing math).
9. Guest operations (check-in, contact, housekeeping, emergency, team, local services; no public disclosure of access codes).
10. Review & submit (human-readable preview plus per-capability blockers; save draft and resume).

One question group per screen; progress + Back/Continue; autosave on server; skip optional questions; preserve the draft and return path through authentication. Show "Submit for review" rather than "Publish" to owner/manager unless active scoped authority explicitly grants publishing. Do not publish or accept instant bookings until applicable readiness gates pass.

## Project portal
Public project page includes cover, ordered gallery, location, shared amenities, story, categories, eligible units, stay options and service responsibilities. Project CTA can search homes in this project. Each unit links back to its project. Owner/private portal adds assigned units, shared policies, reporting and legitimate editing rights. Project-wide fields are edited only by verified project-level delegates/admin.

## Acceptance tests
- Existing project selection reuses same Project ID; no duplicate building is created.
- Owner A cannot edit owner B's home or project gallery; manager authority is scoped and expires.
- Draft submissions are invisible to public search; proof of ownership is never public media.
- One Unit ID survives added rental/sale offerings, owner/manager change and gallery edits.
- Unit/category/project galleries remain distinct, ordered and previewable on mobile/desktop.
- Project cover absent has accessible fallback; no fake imagery/claims.
- Pricing, availability and publish/operate/settle gates remain server-authoritative.
- Round trip: enter → save draft → sign out/in → resume → submit → review → activate → public project and unit → inquiry/booking.

## Implementation (2026-09-30)

The unified `/property/onboard` intake now serves any signed-in applicant and stores applicant-scoped drafts with separate Project and Unit media. Admin `/app/admin/property-submissions` verifies authority, duplicates and media and converts a submitted application atomically into draft canonical records. A selected existing project is reused, while a genuinely new project requires a canonical area, address and coordinates. A verified owner receives a unit-scoped owner role and ownership period; an approved management company can be granted an organization-and-project-scoped MC role. No submission directly publishes inventory. Admin completion continues through the server-governed readiness and compliance workflow.

The admin new-property entry redirects to the same intake. Project public gallery is rendered from the canonical project media relation. Existing projects' shared media remains admin-controlled; applicant project images are attached only to newly created projects, never silently to an established residence.

Known hard gate: project/owner verification is an explicit admin decision, not automated legal verification. Final publication requires separate existing compliance, engagement, pricing and category review. Browser E2E and CI must pass before merging.
