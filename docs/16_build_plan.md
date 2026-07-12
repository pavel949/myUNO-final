# 16 · Build Plan — one task at a time, first loop first

**What this document is.** The ordered task list a cheaper model executes, one task per session, top to bottom. Each task says **what** it builds, **where** (files), its **definition of done (DoD)**, what it **connects to**, and which **specs** it draws from. Global rules for every task:

- Read `CLAUDE.md` + the named spec sections before writing code. **Never invent** — a missing text/rule/field/flow goes to `docs/open_questions.md` and the task stops at that edge.
- Every task ends with green `npm test`, `npm run build`, lints passing, and **a commit** naming the task id.
- UI tasks use design-system components only (T-04/T-05) and content keys only (`needs_review` drafts per doc 05 §1). Every list/screen ships empty/loading/error states.
- New user-facing strings, config parameters, events, and notifications must match the registries in docs 04/05/11/13 — additions require editing those docs in the same commit.
- Tests named in a DoD are mandatory, not aspirational.

Dependencies are strictly linear unless a task names an earlier prerequisite; ↳ marks sub-order within a phase.

---

## Phase 0 · Foundation

**T-001 · Scaffold the app.** Next.js + TS strict + Prisma + Tailwind + Vitest three-tier setup + ESLint (incl. placeholder rules for boundary + no-literal-ui-text lints) + prettier + CI workflow (test/build/lint) + `src/` layout of doc 14 §2 with empty module folders and `README` stubs. DoD: CI green on an empty app; `npm run dev` renders a placeholder page. Specs: 14 §1–2.

**T-002 · Database bootstrap.** Prisma schema for the **spine**: Identity, AuthAccount, OneTimeToken, Project, Unit, UnitEngagement, Organization, RoleAssignment, MediaAsset, AuditLog + enums; first migration; test-DB config; `src/test/util.ts` (resetDb, factories). DoD: migration applies; factories create a project→unit→identity→role chain in a passing integration test. Specs: 02 §§2, 10.

**T-003 · Config module.** ConfigParameter/ConfigOverride/ConfigChange tables; `config.get()` resolver (unit→project→global, 60s cache); seed script with **every** doc 04 parameter incl. catalogs; typed accessors for schedules. DoD: resolution-order integration tests; seed idempotent; changing an override invalidates cache. Specs: 04 all; 02 §8.2.

**T-004 · Content module.** ContentKey/Translation tables; `t()` server helper + client hook with fallback chain; locale routing (`/{locale}` public, identity preference in-app); seed the `common.*` namespace; the `no-literal-ui-text` lint activated. DoD: fallback tests (missing th → en → ru); lint fails on a literal-string fixture. Specs: 05 all.

**T-005 · Design tokens & primitives.** Tailwind theme from doc 06 §2 tokens; components: Button, Input, Select, Checkbox/Radio/Switch, Chip, Avatar, Badge/VerifiedBadge, Modal/Sheet, ConfirmDialog, Toast, Tabs, SkeletonBlock, EmptyState/ErrorState/LoadingState, DataTable, StatTile. DoD: component tests for Button/Input/Chip states; a `/design` dev page rendering every component in every state. Specs: 06 §§2–3.

**T-006 · Auth.** Credentials register/login/logout, sessions, password reset + email verify via OneTimeToken; email seam (Resend adapter + console fallback); rate limiting; `VerifyEmailBanner`. DoD: integration tests for register/login/reset/verify incl. token expiry/reuse; N-01/N-01b sent via seam. Specs: 07 F-AUTH-1..3; 12 §3; 02 §2.

**T-007 · Permissions.** `core.can()` + PERMISSIONS table + special predicates; role grant/revoke services; the **table-driven matrix test** from doc 03 §3. DoD: matrix test file mirrors doc 03 row-for-row and passes. Specs: 03 all.

## Phase 1 · Core records & admin editors

**T-008 · Projects & units CRUD (admin).** Admin panel shell (S14 sidebar, admin-gated) + Projects/Units sections: create/edit, media upload via the media seam (strict-name guard, signed URLs), status transitions with the permitted-use gate blocked until compliance exists (T-027 completes it). DoD: gate refuses `live` without `permitted_use_confirmed_at`; audit rows on every edit. Specs: 08 §6.1–2; 02 §§2.4–2.5; 12 §4.

**T-009 · Admin: configuration editor.** The grouped registry UI, per-project/unit override tables, schedule editors (season calendar, cancellation policy), change history. DoD: founder can change `services.take_rate_pct` for one project only; ConfigChange rows written; schedule validation refuses `tm30_sla_hours > 24`. Specs: 04 §1; 08 §6.4.

**T-010 · Admin: content editor.** Namespace tree, three-column RU/EN/TH editor, statuses, placeholder validation, CSV export/import. DoD: editing a key updates a rendered page after cache expiry; placeholder mismatch blocked. Specs: 05 §5; 08 §6.3.

**T-011 · People & roles admin.** Identity search, role grant/revoke with scope pickers, org CRUD (MC/juristic), invite + claim flow (F-AUTH-4), blocked-identity kill switch. DoD: claim link e2e test; blocked identity loses access mid-session test. Specs: 07 F-AUTH-4; 03; 02 §2.7–2.8.

## Phase 2 · Stays (the loop's heart)

**T-012 · Availability & pricing engine.** BlockedDate, PricingRule tables; the overlap rule; season resolution (config calendar + markups + rules + LOS discounts + cleaning fee) → `computePriceBreakdown`; hold-awareness (`isActiveHold`). DoD: unit tests covering doc 02 §3.4 resolution order, month-boundary seasons, min-nights, holds. Specs: 02 §3; 04 §§2, 4.

**T-013 · Booking lifecycle.** Booking/BookingGuest/BookingChange tables + state machine (all transitions of doc 02 §3.1 incl. requested/expiry paths) as `booking` module services; scheduler jobs: hold expiry, request auto-decline. DoD: integration tests per transition incl. race (double-book 409) and job effects. Specs: 02 §3; 07 F-GUEST-3/4.

**T-014 · Payment rails: cash + seam/mock.** **Cash rail first** (`recordCashPayment`/`recordCashRefund` capturing received_by/received_at/receipt_ref — the loop-one primary method, flow F-OPS-6) plus the `finance` provider seam (createCheckout/confirm/refund/preauth), mock checkout page, idempotent confirm (return + webhook), Payment/Refund tables (with `method`), ledger auto-entries on payment. DoD: recording a cash payment flips a booking `pending_payment→confirmed` and writes the ledger revenue entry; webhook idempotency test; refund lifecycle test (cash **and** card); mock page drives a card booking to `confirmed`. Specs: 10 §§1–3, 8; 02 §5; 04 `booking.payment.*`.

**T-015 · Search & public booking UI.** Public pages: search (S3, filters from config catalogs, map), unit detail (S4) with calendar + BookingWidget, review-and-reserve (S5) with method choice from `[cfg] booking.payment.methods_enabled` (cash-only in loop one) and auth-inline, request-to-book variant; trips list with cash-due / hold state. DoD: e2e happy path register→search→**reserve (cash) → ops records cash → trips shows confirmed**; card path via mock when enabled; unhappy: cash-not-collected cancel, dates-taken race, below-min-nights. Specs: 07 F-GUEST-1..4, F-OPS-6; 06 S3–S5; 08 §1.

**T-016 · Cancellation & modification.** Policy snapshot at booking; cancel flow with live refund math dialog; date/party modification with re-price, balance checkout, atomic-on-payment; host-cancel full refund. DoD: unit tests for each policy schedule; integration: increase-pay-fail leaves booking unchanged. Specs: 07 F-GUEST-8/9; 04 §5; 10 §8.

**T-017 · Notifications core.** Notification/NotificationDelivery tables, `comms.notify()`, in-app bell + SSE stream, email channel, digest job, per-type mute preferences, quiet hours. Wire all stay-related catalog entries (N-02…N-14, N-33/34). DoD: catalog-driven test that each wired trigger writes rows + respects mutes/● rules. Specs: 11 all.

## Phase 3 · Communication layer

**T-018 · Threads & messages.** Thread/Participant/Message + SSE bus seam; find-or-create rules per context; read receipts; photo attachments; system messages; inbox + thread UI (S9). DoD: participant-only access tests; receipt + dedupe tests; booking confirm posts a system message. Specs: 09 §1; 02 §7.1; 06 S9.

**T-019 · Tickets.** Ticket/TicketEvent + status chart + SLA job + assignment rules; raise/detail UI (S10) with StatusTimeline; reporter-visible history; N-31/35/36. DoD: SLA escalation integration test; reporter sees every transition. Specs: 09 §2; 04 §6; 06 S10.

**T-020 · Announcements.** Announcement/Read tables; composer with posted-as + audience; home-space display + N-32. DoD: audience filtering tests (owners-only invisible to guests); juristic-member can post as their org only. Specs: 09 §3; 03 §4.

## Phase 4 · Services marketplace

**T-021 · Providers & vetting.** Provider tables, public application form (F-PROV-1), admin vetting queue, badge, provider portal shell + member roles. DoD: application→vetting→active e2e; badge renders only from `vetted_at`. Specs: 07 F-PROV-1; 02 §4.1.

**T-022 · Services & catalog.** Service tables + editor (provider portal) + admin approval flag; public/marketplace browse (S11) scoped by project context. DoD: approval flag honored; scoping tests. Specs: 07 F-PROV-2, F-SVC-1; 02 §4.2.

**T-023 · Service orders.** ServiceOrder state machine + slot picker + checkout via seam + accept-SLA job + decline/no-show/refund paths + quote flow via threads; my-orders + provider queue UIs; N-21…N-27. DoD: full lifecycle integration tests incl. no-show full refund + auto-ticket; any-role ordering test (owner orders for their unit). Specs: 07 F-SVC-2..4, F-PROV-3; 04 §§5–6; 10 §3.

## Phase 5 · Ops & compliance

**T-024 · Ops board & check-in/out.** S12: arrivals/departures with verification states, check-in confirm (spawns TM30 rows), condition reports (camera/upload flows), check-out inspection. DoD: check-in creates Tm30Filing per foreign guest with correct `due_at`; condition report photo flow works. Specs: 07 F-OPS-1, F-GUEST-6/10; 02 §6.

**T-025 · Pre-arrival verification.** PassportCapture UI per party member (encrypted fields + media kind=passport), deadline job → `verification_status` transitions + N-07/N-08; staff capture-at-door path. DoD: encryption verified in tests (raw DB value ≠ plaintext); deadline unhappy path fires. Specs: 07 F-GUEST-5; 12 §§1, 4.

**T-026 · TM30 queue.** The SLA-sorted queue with countdowns, passport panel (access-logged), file/receipt recording, failure + escalation path (N-24). DoD: access writes AuditLog; escalation timing test; failed filings stay red until filed. Specs: 07 F-OPS-2; 04 §7.

**T-027 · Compliance records & mobilization.** ComplianceRecord CRUD; MobilizationChecklistItem with gates (mandate→engagement active; legal→permitted use; go-live flips unit live); engagement editor requiring the NOI cap for direct-managed. DoD: gate tests; a unit walks draft→live only through the checklist. Specs: 07 F-OWN-1; 02 §§2.6, 6.2, 6.4.

**T-028 · Retention & privacy jobs.** `delete_after` deletion job, identity anonymization flow, data export, retention reporting panel. DoD: passport media deleted past deadline in test; export contains no other identities' data. Specs: 12 §§2, 6.

## Phase 6 · Money truth

**T-029 · Ledger & cost recording.** LedgerEntry append-only service + admin browser + staff record-cost flow (receipt photos) + reversal-by-admin; auto-entries audit (booking revenue, commissions, refunds). DoD: append-only enforced (no update path); every confirmed booking test-verifies its entries. Specs: 02 §5.3; 07 F-OPS-3; 10 §4.

**T-030 · Statements.** Monthly generation job per engagement type (cap pro-rata math; refusal without cap), draft→publish sign-off, StatementView (S8) + PDF render, N-16. DoD: golden-number unit tests for all three engagement types incl. cap-bites/cap-doesn't/missing-cap-refusal; owner sees published only. Specs: 10 §4; 07 F-FIN-1; 06 S8.

**T-031 · Payouts & reconciliation.** Payout recording (owner + provider remittance reports per cadence), reconciliation board (unmatched payments, failed refunds, recorded→reconciled). DoD: remittance math tests; failed refund surfaces until cleared. Specs: 10 §§5–6, 9; 07 F-FIN-2.

**T-032 · Deposits (pre-auth) & damage claims.** Pre-auth schedule/void/capture via seam per config mode; F-DIS-1 claim flow with evidence + 48h window; F-DIS-2 dispute ticket with record attachment. DoD: void-on-clean-checkout and capture-on-claim integration tests (mock provider). Specs: 10 §7; 07 §8.

## Phase 7 · Surfaces that sell and retain

**T-033 · Owner experience.** Adaptive landing (S7: single-unit vs portfolio), ProjectSwitcher, unit dashboard (tiles, bookings, statements, tickets), owner-stay booking (F-OWN-6 zero-rent type + ops notify + cleaning charge config), sell-interest card → thread + event. DoD: adaptive rules tested (1 unit / n units); owner-stay excluded from revenue-occupancy in rollups. Specs: 07 F-OWN-2..6; 06 S7; 13 §1.

**T-034 · In-stay home space.** S6: stay card, quick actions, services rail, announcements, handbook, extension entry; role-composed rendering (RoleContextBanner). DoD: guest sees exactly their stay's project scope; extension drives F-GUEST-9. Specs: 06 S6; 07 F-GUEST-7.

**T-035 · Public pages.** Master landing (S1), audience pages ×6 with lead forms (N-29), project landing (S2), trust + legal pages (reserved keys), SEO/GEO layer (meta, JSON-LD, llms.txt, sitemaps, hreflang). DoD: all keys exist `needs_review`; structured data validates; lead form creates thread + event. Specs: 08 §§1–4, 7.

**T-036 · MC portal.** Scoped boards for MC members (their units' bookings/tickets/calendar), fee report, announcement posting as MC. DoD: scope-leak tests (MC sees only engaged units); fee lines match config. Specs: 07 F-MC-1..2; 03 §4.

## Phase 8 · Measurement & channels

**T-037 · Analytics.** `track()` + full event catalog wiring + MetricDaily rollup job + admin dashboard tiles + ops SLA health. DoD: catalog-coverage test (every doc 13 event has an emitter); rollup numbers match record-derived formulas in fixtures. Specs: 13 §§1–3.

**T-038 · Buyer signals.** Detectors (config thresholds) + staff message-flag action + Signals admin funnel + owner sell-interest mirror. DoD: detector unit tests; dedupe rule; funnel transitions audit-logged. Specs: 13 §4; 07 F-BUY.

**T-039 · iCal channel sync.** Per-unit export URL + import poller job + conflict detection (N-25) + integration health panel. DoD: import idempotency (UID) tests; conflict path test. Specs: 14 §5; 07 F-OPS-4.

**T-040 · Messenger channels (dark).** WhatsApp/Telegram `deliver()` adapters behind disabled config; template rendering from the same content keys. DoD: enabling the flag in test routes ●-types through the adapter mock. Specs: 11; 04 §7.

## Phase 9 · Launch

**T-041 · Seeds & demo data.** Full staging seed: one real-shaped project, units across engagement types, providers/services, demo identities per role — the founder's walkthrough environment. DoD: every doc 07 flow walkable on staging start-to-finish. Specs: all.

**T-042 · Hardening pass.** Rate limits, headers/CSP, error-page unification, load sanity on search/booking, accessibility audit against doc 06 §5, PII-log scrub verification. DoD: checklist in the PR description, each item evidenced. Specs: 12; 06 §5.

**T-043 · Launch checklist.** Production env + secrets, domain, backups verified (restore drill), payment provider adapter (Q8 — when chosen), monitoring/alerts, legal/trust content in place (Q15/Q16 — founder-provided), TM30 process rehearsed with staff (Q10). DoD: the checklist file committed with every box ticked or explicitly waived by the founder. Specs: 15; open_questions.

---

**Sequence rationale.** Foundation (0) exists because every later task consumes config/content/tokens (doc 01 D4). The stay loop (2) precedes communication (3) because the loop is the business; services (4) before ops/money detail (5–6) because orders feed the ledger; surfaces (7) come once the machinery they present is real; channels and analytics (8) bolt onto working records; launch (9) last. **The first loop is complete at T-032**; everything after widens and polishes it. Blocked founder inputs (⚠ Q-items) are all in phases 8–9 or content-only — no task before T-043 hard-blocks on an open question.
