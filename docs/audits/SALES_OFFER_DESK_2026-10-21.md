# Sales offer desk — synthetic implementation evidence

Type: historical, branch-specific implementation evidence; not a production readiness assertion.

Baseline: `971f3d1c0877e7563bbf45ba688cf3cd421c2664` (main including PMS #316 and property editing #317). Scope: CO02/CO07; AT19/AT21/AT28/AT29.

## Architecture and delivered path

`/ops/sales?spaceId=…` uses the existing effective operating-space `manage_reservations` intersection, canonical physical Units/categories/media, pricing engine, booking calendar/source-authority checks and cancellation policy. Up to four alternatives retain independent dates/parties and original THB integer-satang amounts. The existing canonical engine remains the sole calculator; the desk also preserves tariff tax/service/breakfast inclusion metadata and source deposit amounts separately from stay totals, retaining each declared currency without conversion.

`SalesTariffValidation` requires a separately reviewed fingerprint/version/evidence/currency/date window/expiry. No production tariffs, Guide/Net reinterpretations, LOS/payment rules or approvals are installed. Production Layantara alignment with the approved commercial baseline is still unresolved; calculability alone cannot yield a firm sales offer.

`SalesOffer`/`SalesOfferOption` store append-only revisions with server-created guest snapshots, unique revision/command identity, same-transaction option insertion and a deferred 1–4 alternative constraint. Snapshot changes never rewrite accepted history. Expired, superseded, occupied or changed-rule offers must be revalidated before sharing, export or a new request. Corrections create another version.

An explicit staff action creates a high-entropy 32-byte proposal capability. `SalesOfferShare` stores only its hash and expiry/revocation. A standalone `/proposal#…` document clears the fragment and exchanges it in a POST body, omitting cookies. It renders no authenticated shell. Public outputs recursively allowlist fields and contain no guest registry, Net, margins, commission, private notes, proof references, internal fingerprints or credentials. Revocation, expiry and loss of issuing staff scope deny access. Stale but unexpired links identify the historic revision with a warning and disable export/CTA.

Public CTA opens the canonical property/review journey and grants no booking-write authority. An explicit staff handoff creates `requested` through the existing inventory-locked `createBookingAttempt`, with fresh scope/rules/price validation, immutable offer reference, deterministic retry recovery and automatic client notifications suppressed. There is no payment, hold or confirmation merely because an offer or request exists.

RU/EN/TH copy and browser print/Save PDF use the same snapshot as the proposal. This is **not** a server-generated binary PDF download. Occupancy dashboards, heatmaps, post builder, multi-unit bundles and non-THB engine adapters are deferred.

## Verification record

- Prisma schema validation: passed.
- Migration reviewer: additive tables only, indexed FKs, RLS and grants revoked from anon/authenticated/service_role, pinned trigger search paths; no existing spine DDL, seeded approvals or credentials.
- Fresh disposable PostgreSQL 16: full migration chain applied.
- Existing disposable DB: main migration chain → synthetic existing identity → new migration; existing identity retained; Prisma reported no schema drift. Repeated migration deploy passed with no pending migrations.
- Frozen-source sales/HTTP/canonical pricing and booking regression run: 95 tests passed across six files (including scope isolation, recursive projection, rule changes, expired/revoked tokens, stale revisions, immutable/sealed snapshots, failure/retry and idempotent request creation).
- Full lint, production TypeScript and production build: passed on frozen source. Structural design-token/content/reachability guards: 14 tests passed.
- Chromium production-server journey: all 10 steps passed, with no page errors or third-party browser requests. Desktop/mobile staff UI, signed-out mobile client view, temporary read failure/retry, text copy, print CSS and actual synthetic A4 PDF rendering, delayed same-tab responses/printing the correct snapshot, authenticated-only idempotent request, stale-price controls and explicit link revocation were exercised. Screenshots were visually inspected.
- Independent security review: found and then re-reviewed fixes for response races and external-image privacy; no remaining concrete blocker. Images now reuse same-origin Next optimization with existing remotePatterns, CSP img-src self, and no forwarded recipient headers.
- Final aggregate suite: 574 files / 6,174 tests passed (exit 0). The final commercial-policy projection was additionally verified by 24 sales/HTTP tests, production build, TypeScript, lint and all 10 Chromium steps. An earlier aggregate run exposed token/content/reachability integration issues and a test/module mismatch during active edits; those were corrected before the frozen run.

Reproducible browser sources: `scripts/e2e/seed-sales-offer.ts`, `scripts/e2e/sales-offer.mjs`. They require the existing exact loopback isolation guard and HTTP egress blocker. They use only synthetic local records/capabilities; raw tokens are never written to report artifacts or logs. Browser acceptance is included in the existing isolated CI job. Synthetic screenshots/PDF are temporary runner artifacts, not real proposals.

## Release prerequisites

Production migration/deploy/runtime are **not performed**. Before release: review/apply the additive migration in a separately authorized window; reconcile and independently approve applicable tariff/policy baselines per property and date coverage; review locale drafts; verify current staff scope/guest registration; complete production release and runtime acceptance. No broad role expansion, credentials, real links, messages, data import or production records are included.

Code rollback can remove the entrypoint and handlers while retaining immutable history. Revoke issued capabilities if disabling guest access; never rewrite historic snapshots or booking financial terms. A new canonical pricing semantic version must invalidate old tariff reviews.
