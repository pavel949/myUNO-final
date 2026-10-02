# P0/P1 product consolidation — 2026-10-03

## Scope

This release closes the product-design P0/P1 consolidation without introducing
parallel property, booking, pricing, PMS, finance or CRM entities.

### P0 — public product clarity

- Top-level navigation is job-based: **Stay / Buy / Own / Services / My UNO**.
- Explore, Areas, Projects, Partners, Sell, List and Management remain secondary
  paths rather than equal-weight product modules.
- `/app` is a persistent **My UNO** relationship hub instead of an automatic
  redirect to one role surface.
- A destination configuration boundary now owns destination-level name, country,
  currency, timezone, locales and proposition.
- The public shell, homepage proposition, area discovery, homes, partner network,
  management and resale metadata read the destination boundary. Phuket remains
  the default configured destination.

### P1 — connected property lifecycle

- Owner acquisition explicitly connects **List it / Manage it / Sell it** on one
  canonical property lifecycle.
- Existing owner unit workspace is presented as a **Property Digital Twin** with
  direct access to performance, money, operations, property record and decisions.
- No new owner/property data model was created; the digital twin is a read/action
  composition over existing canonical owner, booking, statement, compliance,
  ticket, service and property records.
- PMS operations default is **Today / Needs attention now** with arrivals,
  departures, booking requests, unpaid stays, service orders and open tickets
  ahead of secondary SLA metrics.

## Invariants preserved

1. One Identity/Party.
2. One physical Unit.
3. Existing booking, pricing, finance, service-order and PMS writers remain canonical.
4. My UNO is navigation/orchestration, not a second authorization or data layer.
5. Destination configuration does not fork domain engines or databases.

## Verification

Required release checks:
- lint
- TypeScript production typecheck
- focused unit tests including destination configuration and Navbar
- production build
- existing migration/drift gates (no schema migration in this change)
- runtime visual check of homepage, My UNO, owner unit and operations Today screen

Code/CI passing is not evidence that production deployment has updated.
