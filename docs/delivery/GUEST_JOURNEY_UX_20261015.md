# Guest journey UX delivery — 2026-10-15

Scope: public discovery → project/category → home → review → authentication → checkout → trips → services → messages/help/requests.
Baseline: main 82648488cb6b5cb7e0541a007166f20730ef9f70. Existing open PRs #275/#277/#278/#279 were inspected and kept separate.

## Reconciliation and outcomes

| Surface | Disposition and change | Verification |
| --- | --- | --- |
| Search | Preserve canonical search/quote/map; add stay total, capacity, bedroom filter, mobile list/map, saved homes | Component and route tests |
| Unit | Preserve canonical pricing and booking gates; mobile choose-dates action, service-fee line, cancellation ladder, explicit total, offer sharing | Booking-mode, stale-quote and share tests |
| Imported inquiry-only units | Preserve strict no-booking gate; public-intent sharing and mobile inquiry action | Type/build verification; live updated UI not checked |
| Project/category | Preserve context; native mobile gallery and photo recovery | Existing project/media regressions |
| Homes monthly/buy | Retain lease/search context and separate load failures from empty inventory | Existing composition regression |
| Saved | Connect existing saved-unit writer with session-derived ownership, no-store reads, serialized idempotent default-list update | Mocked route authorization/ownership/retry tests; real DB lock not checked |
| Review/checkout | Retry quote, retain created booking after checkout failure, explicit trip/order exit, no premature Home Space redirect | Checkout/review recovery tests |
| Login/register/Google | Retain sanitized local return context; missing Google config no longer yields inert CTA | Return-path and OAuth callback regressions |
| Trips/Home Space | Remove unsupported ready-for-check-in wording; retain existing trip/handbook/service navigation | Unpaid/recovery and Home Space contract tests |
| Services | Distinguish loading/error/empty; choose between multiple stays; preserve order context; truthful fallback without standalone context | Recovery/context/money tests |
| Requests/messages/help | Retain request context after login, open acknowledged request, retry messages while preserving draft, useful empty states and plain-language help | Request/message/auth regressions |

No schema migrations, production inventory changes, payment submissions or communications were performed. Existing booking, price, authority and financial writers are preserved. New copy is registered as needs_review; runtime draft fallbacks do not approve CMS translations.

## Verification

- Aggregate guest-route run: 31 test files, 156 tests passed.
- Full repository ESLint: passed.
- Production TypeScript configuration: passed.
- Production build: passed (196 static pages generated).
- Build ran without DATABASE_URL; database-backed content approval gate was skipped by its existing behavior. This is not live content approval.
- Baseline production homepage, search and Villa A19 were inspected read-only in the browser. That inspection predates this branch.
- New deployed UI, real-device mobile/keyboard, live Google OAuth, live payment and DB-backed shortlist concurrency: not checked.

## Remaining gaps and rollout

1. Standalone service checkout is not implemented by the actual server/domain, despite earlier documentation. The UI now offers an honest handoff; it does not invent a project or promise an accepted order.
2. Trips API/UI pagination beyond the first 50 stays remains a separate gap.
3. Emergency-specific assistance needs verified contact/configuration; no numbers or response-time claims were invented.
4. Complete additional quick amenity filters, full-screen photo viewer and recommendations ranked against canonical availability in follow-up work; existing functionality was not relabelled as complete.
5. Before merging/deploying, inspect CI and apply this branch to a reviewable environment; run guest mobile/auth/quote/order scenarios against real configuration. No production-readiness claim is made.
6. Rollback is a code revert; this delivery requires no data rollback.
