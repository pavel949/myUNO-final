# myUNO UX system implementation — 2026-10-02

## Scope

This release implements the product-design direction defined in `docs/canonical/PRODUCT.md`, `docs/canonical/DESIGN.md`, and `docs/canonical/ROLE_WORKSPACES.md` without creating parallel booking, pricing, property, finance, or PMS entities.

## Public information architecture

Primary public navigation:
- Explore
- Stay
- Homes
- Services
- Owners
- Partners
- My myUNO / account context

Secondary paths remain available through More:
- Monthly
- Sell
- Rent out
- Property management
- Areas
- Global desks
- Trust
- Help
- About
- Developer and management-company routes

The new `/partners` hub connects existing management-company, developer, and provider journeys rather than creating a second partner domain.

## Homepage and search

The homepage hero is consumer-first:
1. short Phuket proposition;
2. one connected discovery/search surface;
3. services as the secondary consumer action;
4. sell, rent-out, and management as tertiary supplier paths.

`DiscoverySearch` retains Stay / Monthly / Buy intent routing. Property type, bedrooms, and budget are progressively disclosed under More filters. Canonical availability and price remain server-owned by the existing search / quote / offering logic.

## Role workspaces

Role homes follow the canonical workspace model:
- Admin / control plane: Needs attention.
- Management company / operator: Today + action queue; KPI wall removed from the first view.
- Owner: My Homes.
- Provider: My Orders / Provider workspace.

No role home becomes a second writer. Actions continue to route to canonical booking, ticket, service-order, finance, calendar, or property writers.

## Media

No new media model was introduced. The existing scoped gallery implementation remains canonical:
- Project → `ProjectMedia`
- Category → `InventoryCategoryMedia`
- Unit → `UnitMedia`

`ScopedGalleryEditor` remains the preferred editing surface. MediaAsset bytes are shared while ordering and covers stay scoped to the presentation level.

## Design-system rules reinforced

- Andaman / deep / ivory / paper / restrained sun palette remains canonical.
- Outfit / Manrope / Noto Sans Thai typography remains canonical.
- No arbitrary new type scale was introduced.
- Public surfaces remain spacious/editorial; relationship surfaces moderate; operational surfaces task-dense.
- Cards represent selectable objects; operational state is expressed with rows, timelines, queues, tables, and explicit status.
- High-stakes actions continue to require canonical confirmation.

## Verification gates

Before merge:
- lint;
- migration replay and drift;
- focused unified-engine tests;
- full tests;
- TypeScript production typecheck;
- production build.

Vercel preview may remain blocked independently by the account build-rate limit; that is not evidence of code CI failure.
