# myUNO: Discovery, PMS, Stitch — audit and corrections, 2026-10-08

## Executive assessment

| Direction | Assessment | Evidence and corrections |
| --- | --- | --- |
| Discovery | Public journey is usable in the inspected desktop scenarios | Homepage exposes project and unit cards; browse before dates; exact details for imported enquiry-only homes; inline dates and canonical quote; category/context-preserving return. Production Layantara A10, G5 and Legendary D201 inspected. G5 15–18 October 2026 quoted ฿32,400; scoped date search returned exactly G5 at ฿10,800/night. |
| PMS | Partial operational readiness; full resort operation cannot yet be certified | Many real screens exist, but staff seasonal rates, MC stay detail, workspace finance/team and category exception review remain blockers. Corrected operational context, sidebar scope selection, task deep links, edit login destination, tariff error recovery and explicit cancellation override reset. No actual production tariffs, reservations, tasks or money were changed. |
| Stitch | Broad shell adoption, incomplete screen-level migration | All 160 routes classified: 51 admin-shell, 42 workspace-shell, 30 consumer-shell, 37 root-only. Root-only is not automatically non-Stitch: several public pages compose their own canonical panels. Fixed 26 undefined typography utilities across nine files, mobile booking/menu overlap, project-card duplicate CTA arrows, contrast and misleading date-free availability count. |

## Live evidence and access limits

Public Discovery was exercised through actual links, date picker and return navigation. A transient search request failed; fresh public API requests and a page reload returned correct unit/category pricing. A Retry action now retries the same request without losing context. The browser also blocked direct navigation to the JSON API once; this was not treated as evidence of a persistent server outage.

PMS runtime audit reached its actual authentication boundary. `/ops` and representative staff, MC and admin routes require signed-in roles. The secure sign-in flow did not produce a verified signed-in session. Consequently no internal PMS screen overlap, full reservation lifecycle, actual category tariff write, resort night audit or role-isolation behavior is certified by this pass. The source and mocked/pure test audit continues to provide concrete evidence; it is not a substitute for authenticated visual verification.

Public Stitch screenshots cover representative homepage, property catalogue, services/detail, help/accordion, legal, login, projects, Legendary portal/anchor, D202 and areas. Search screenshot/DOM capture mismatch is marked inconclusive by the visual worker. Mobile collision repair is based on conflicting source positioning and shared component structure; mobile viewport runtime was not available.

## Remaining priority work

1. Authenticate with the operator/admin and delegated MC roles and complete the internal 61-route visual/workflow checklist. Verify one unit, one condo subset, and the complete Layantara operating space separately.
2. Give scoped resort pricing operators a canonical permitted seasonal tariff workflow; preserve current booking and authorization gates.
3. Category rates need membership/exception comparison, inheritance visibility, reviewed bulk apply and revision protection. Current bulk action copies a unit grid.
4. New or renamed source seasons need booking-policy compatibility validation before success; tariff preview must distinguish saved data from a proposed draft and full canonical guest quote.
5. Resolve MC booking-detail reachability and space-scoped Finance/Team workflows through reviewed authority contracts, rather than weakening admin/staff guards.
6. Finish screen composition migration: duplicate MC rails, service detail legacy structure, property-listing forms, reconciliation shell and remaining palette inconsistencies.
7. Reconcile canonical design documentation with the later Stitch token override; verify photo provenance/representation and remaining EN fallbacks/technical copy.

## Companion evidence

- discovery-navigation-audit.md — Discovery route matrix and data boundaries.
- pms-runtime-audit.md — real login/access observations and 61-route runtime checklist.
- pms-source-audit.md — full staff/MC/owner surface and navigation audit, repair appendix.
- pms-rates-audit.md — pricing hierarchy, rate UX, verified repairs and remaining business gaps.
- stitch-coverage-audit.md — all 160 route rows, shell inheritance and exact source defects.
- stitch-public-runtime-audit.md — representative visual assessment and screenshots.

## Validation and release

58 focused interaction, scope, tariff writer, pricing parity and public discovery tests passed before the combined main-only release. Targeted lint and the production Next.js build (including production TypeScript) passed. Authenticated DB integration is unavailable locally; destructive database reset suites are not run. Financial, booking and role permissions are unchanged except honoring the editor's existing explicit standard-cancellation reset on future saves; historical reservation snapshots are not rewritten.
