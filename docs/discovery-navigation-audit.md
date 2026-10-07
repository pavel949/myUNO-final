# Public discovery and navigation audit — 2026-10-07

Repository: pavel949/myUNO-final. Baseline: main b801c442c57e9c2a95192b0f1ac09e4f3c32d22a.
Scope: homepage, public stay search, project catalogue, project portal, inventory categories, exact-unit details, and return navigation. The Airbnb reference is a journey pattern: browse before dates, photo-led cards, a distinct detail page, dates on that page, and preserved search context.

## Observed production problems

- Homepage offer shelf was empty: its strict live-only reader disagreed with imported public inventory shown on project pages.
- Search without dates showed only a prompt, preventing exploratory browsing.
- Layantara: 39 visible homes; four media-ready homes opened detail pages, the remaining cards sent users to a general enquiry form. The Title Legendary: all six condo cards led to that form rather than their own pages.
- G5 opened, but had no inline date selection. Visitors had to return to search to obtain a quote.
- Category IDs were lost by search requests and SearchBar submission. Unit return links discarded filters and map bounds.
- Project section navigation did not account for the persistent header.

## Route matrix and implemented behavior

| Entry / route | Destination and behavior | Verification |
| --- | --- | --- |
| `/` home finder | `/search`, with or without dates; preserves selected location/guests | Source review, production build |
| `/` offer cards | Exact `/units/[id]`; media-ready imported discovery homes included; unknown rates shown on request | Reader tests, static guard |
| `/projects` | Existing public project catalogue → `/projects/[slug]` | Runtime baseline, source review |
| `/projects/[slug]` | Every public home card → exact unit, including enquiry-only inventory | Layantara and Legendary baseline, source review |
| `/projects/[slug]#availability/#categories/#homes/#amenities/#services/#nearby/#location/#lead-form` | Conditional section links; native anchors, sticky-header offset | Source review; runtime verification required after release |
| `/projects/[slug]/categories/[categoryKey]` | Exact unit pages and scoped `/search?projectId=…&inventoryCategoryId=…` | Source review, category propagation test |
| `/search` without dates | Public discovery grid; separate exact-unit and residence links | Baseline screenshot, reader tests |
| `/search` with dates | Existing availability/quote path; category filter reaches grouped and unit endpoints | Interaction tests |
| `/units/[id]` bookable | Inline dates, quote refresh; breadcrumb to parent project; back preserves filters | G5 baseline, source review, type check |
| `/units/[id]` enquiry-only | Own details/photos where ready, parent project and results links, prefilled unit enquiry | Visibility/media tests, source review |
| Invalid/suspended/private draft unit | No public detail; strict booking API remains gated | Visibility tests, source review |

## Data and booking boundaries

Discovery visibility is shared between public project and catalogue readers: live inventory or explicitly managed imported drafts only, excluding suspended units and nonpublic projects. The new reader selects public property facts and ready photos, with no owner/contact fields, booking permission or rates. Imported inventory discovery does not grant booking authority. The existing strict unit API, quotation and reservation gates remain in place. Unknown photos and prices are not manufactured. No migrations or production data edits are needed.

Date and guest changes clear previous quote state immediately. Aborted old quote requests cannot overwrite a newer selection. Search context is carried through project/category/unit links and return navigation. The catalogue is bounded to 200 homes; date-less discovery does not promise availability or execute price/map sorting.

## Validation

- 26 focused tests passed across seven files: public discovery, category propagation, SearchBar preservation, media readiness, commercial discovery, homepage fail-soft behavior and homepage connected-source guard.
- Production TypeScript config passed. Full test-inclusive TypeScript has unrelated baseline failures and is not the production compiler configuration.
- Next.js production build passed, including lint and page generation. Build runs without a local database; the content-review gate therefore skips its database-backed check locally.
- Static app inventory: 160 page files, 227 route handlers, 224 API handlers, no duplicate canonical paths. This is a structural inventory, not a claim that every admin/API flow was executed.
- No test database available: DB-backed integration suites were not run.
- Desktop production baseline was inspected. Mobile, completed reservations, payment and submitted enquiries were not exercised.

## Release verification

Main-only production release is intended, with no preview branch. Record deployed commit and repeat the homepage → search → project → exact-unit journey before considering runtime verification complete. Missing source photos, zero/unknown facts, and unavailable booking terms remain content/operations work; those units stay enquiry-only.
