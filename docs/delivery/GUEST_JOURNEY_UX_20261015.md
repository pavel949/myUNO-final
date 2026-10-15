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

## Completion pass

The remaining guest surfaces are implemented in the same PR:

- Quick amenity filters share the canonical Unit.amenityKeys predicate in dated and undated discovery. Similar homes use actual availability and quoted prices while preserving guest/search constraints.
- Fullscreen galleries support keyboard, swipe, focus return, scroll lock and failed images. Localized controls are wired to unit, project, category and commercial-home pages.
- Trips paginate beyond the first 50 records. Anonymous emergency help exposes verified Thailand emergency contacts without a login or response-time promise.
- Standalone services use an actual vetted provider, explicit service/area coverage and an active responsible organization, with no invented property or guest role. The server owns prices, organization and accepted terms. Address, recipient and commercial snapshots are immutable.
- A stable customer request key serializes concurrent/retried order submissions; changed details with the same key return 409. Customer views exclude internal commission terms.
- Standalone support tickets derive scope from the customer's actual order. Only its active responsible organization can manage the request; unrelated property roles do not grant access. Revoked membership loses conversation access.
- Commission remains attributed to the real service order with nullable project/unit attribution. Existing payment and ledger writers are retained.

## Migration and rollout

`20261015070000_standalone_service_support` is additive: nullable ticket property scope, real order/organization foreign keys, scoped indexes/check, immutable standalone snapshot trigger, nullable retry fields and per-customer unique request key. Historical records are not rewritten. RLS and grants are unchanged. Roll back code independently; retain additive columns and accepted order snapshots.

`services.standalone_offers` defaults to `[]`. Production supply remains disabled until actual service IDs, live areas, responsible organization and reviewed terms are configured. The browser fixture configures synthetic supply only in its disposable isolated database.

New copy is registered as needs_review. Runtime draft fallbacks do not approve CMS translations. No production booking, payment or customer communication is submitted as part of verification.

## Verification evidence

- Initial guest-route suite: 31 files / 156 tests passed; production typecheck, lint and build passed.
- Completion regression suite: 7 files / 39 tests passed, including content registration, locale navigation, standalone parsing/public terms and retry UI.
- PostgreSQL integration coverage includes canonical search constraints, no-property-role standalone ordering, concurrent replay/conflict, immutable snapshots, commission attribution and scoped support access.
- The isolated Chromium workflow applies real migrations, seeds synthetic identities/inventory, builds production code and exercises actual browser/API/database behavior with external egress blocked.
- Final CI and merge evidence is recorded in PR #280. Hosted preview configuration and live payment/OAuth providers are separate runtime dependencies; synthetic acceptance does not claim live provider settlement.
