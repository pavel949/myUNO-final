# 00 · Legacy Audit — the parts bin, piece by piece

**What this document is.** Before designing anything, we open every old repository, say honestly what it is and what state it is in, and make a **take / don't-take / finish** call on each reusable piece — judged against the spine (**project → unit → identity → roles**) and the first loop. Per the constitution: legacy is *a parts bin, not a foundation, and not the look*. Nothing below is wired into the new system as running code; "take" means *take the pattern, the logic, or the schema idea and re-implement it cleanly inside the new architecture*.

**Where the legacy lives.** The repositories are attached to this workspace as sibling folders (they are the founder's GitHub repos), referenced in place rather than copied into `legacy/` — see `legacy/README.md`. Audited: `My-Airbnb-Clone-Copy`, `condo`, `phuket-flea-market-e90916d2`, `airbnb-price-optimizer-rio`, `MyCommand-center`, `geo-seo-claude`, `myUNO-PMS-OS`, `awesome-system-design-resources`.

**The verdict in one paragraph.** Two repositories matter a great deal. **`My-Airbnb-Clone-Copy`** (a complete, well-tested Airbnb-style booking product) is the strongest source of *booking, payments-seam, messaging, and flow logic* — and its stack (Next.js + TypeScript + Prisma + PostgreSQL) is proven in our own hands, which weighs on the stack decision in doc 01. **`condo`** (a production-grade open-source property-management platform for management companies) is the strongest source of *property-operations schema thinking*: organization/role permissions, tickets, announcements, payment splitting, marketplace. Everything the first loop needs exists as a working reference in one of these two — **except TM30 compliance, the NOI-split owner statement as we define it, engagement types, and the content-key/configuration layers, which are greenfield**. The remaining repos are reference material or not usable.

---

## 1. `My-Airbnb-Clone-Copy` — "StayFinder" (full-stack Airbnb clone)

**What it is.** A single Next.js 14 (App Router) + TypeScript + Prisma 5 + PostgreSQL application implementing the complete short-stay loop: search with filters/map, listing detail, booking with server-side pricing, Stripe Checkout **with a built-in mock fallback**, cancellation policies with computed refunds, two-way reviews, real-time messaging (SSE) with read receipts, notifications (in-app + email seam), host availability calendar and seasonal pricing rules, wishlists, host earnings dashboard, co-hosts, admin moderation, email verification and password reset.

**What works.** Effectively all of it — the repo's own documentation describes the loop as verified end-to-end, and it carries three tiers of tests (unit, API/integration against a dedicated test DB, component) running in CI. This is the highest-signal legacy asset: it proves the team's stack and contains dozens of small, correct mechanisms the new platform needs.

**Decisions.**

| Piece | Decision | Why / how it maps |
|---|---|---|
| Stack pattern: Next.js App Router + TS strict + Prisma + PostgreSQL, server actions for reads / route handlers for writes, `Safe*` serialized types at the client boundary | **Take (as pattern)** | Proven in our own codebase with tests; the natural base for the modular monolith (decided in doc 01). |
| Booking availability logic: interval-overlap test, blocked dates sharing the reservation shape, **pending-hold expiry** (`isActiveHold`, cron cleanup), request-to-book vs instant book | **Take** | Directly the stay-booking engine; re-implement inside the Bookings module with myUNO statuses. |
| Server-computed pricing (`computePriceBreakdown`): nightly rate per pricing rule, fees, tax — client-sent totals ignored | **Take** | The exact anti-tamper posture we need; the *numbers* move into the configuration layer (doc 04). |
| Payments seam (`libs/payments.ts`): provider checkout when a key is set, **mock checkout page otherwise**; idempotent confirm shared by success-URL and webhook | **Take** | This seam is precisely how we stay provider-agnostic while the licensed Thai provider is chosen (open question Q8). |
| Cancellation engine (`computeRefund` per named policy + days-to-check-in; soft-cancel with `refundAmount`, `cancelledAt`) | **Take** | Becomes the configurable cancellation policy engine (doc 04 §5); policy tables move to config. |
| Date-change flow (re-validate, re-price, `balanceDue` checkout / `refundAmount` accrual) | **Take** | Our stay-modification flow (doc 07) is this mechanism. |
| SSE messaging (pub/sub bus seam, participant-only access, read receipts, dedupe-by-id echo) and notification bell (typed catalog, per-user SSE stream, best-effort `createNotification`) | **Take** | Becomes the shared communication layer's transport (doc 09); the bus seam swaps to Redis later exactly as its docs note. |
| Email seam (`sendEmail` → Resend or console log) + HTML template pattern returning `{subject, text, html}` | **Take** | Doc 11's channel seam generalizes this to email/WhatsApp/Telegram/in-app. |
| Auth: NextAuth credentials + optional OAuth, hashed single-use tokens for reset/verify | **Take** | Identity module base; add phone as an identifier for this clientele (doc 12). |
| Upload seam (single storage route, strict filename check, swap `writeFile` for S3) | **Take** | Media handling for units, condition photos, message attachments. |
| Define-once taxonomies (`libs/amenities.ts` etc.) + generic `CatalogSelect`, guarded by tests | **Finish** | Right pattern, wrong home: myUNO taxonomies must live in **editable config/content, not code** (docs 04/05). Take the pattern, move the data into the database. |
| Admin moderation, reports, superhost, wishlists, multi-currency display, saved searches | **Don't take (first loop)** | Airbnb-marketplace features outside the loop; wishlist/saved-search may return with the home space later. Multi-currency display conflicts with THB-clarity — revisit later. |
| Its data model (`User`, `Listing`, `Reservation`, flat, host-centric) | **Don't take** | Has no project, no unit-vs-listing split, no roles, no engagement types. The spine forbids inheriting it; doc 02 rebuilds. |
| The visual language (Airbnb-derived UI, its components' look) | **Don't take** | The constitution is explicit: the look is single and new, from `docs/06_design_system.md`. Component *behaviors* (calendar, counters, modal manager) may inform builds; the skin never. |

## 2. `condo` — open-condo-software/condo (open-source property-management SaaS)

**What it is.** A clone of the mature MIT-licensed **open-condo** platform used by Russian-market management companies: a yarn-workspaces monorepo, KeystoneJS GraphQL backend + Next.js frontend, PostgreSQL, Redis, NATS, with ~539 migrations and thousands of merged PRs. Production-grade, actively maintained, extensively tested.

**What works.** Practically everything it ships: organizations with employee roles carrying ~50 granular `canManage*/canRead*` permissions; properties with a JSON unit map; residents bound to property+unit; a deep ticket system (statuses, classifiers, comments, change-audit, auto-assignment, incidents); announcements ("news") with scoping, templates, read tracking and Telegram sharing; channel-abstracted notifications (push/SMS/email/Telegram); a marketplace with invoices; pluggable payment-acquiring integrations with a **multi-recipient payment splitter**; meters; an admin UI; RU/EN/ES i18n as JSON message keys.

**Decisions.**

| Piece | Decision | Why / how it maps |
|---|---|---|
| Org → Employee → Role permission model (checkbox permissions as data) | **Take** | The template for doc 03's permission matrix and for the management-company/juristic-person role; "permissions as configuration" made real. |
| Resident ↔ property+unit binding (`Resident`, `ServiceConsumer`) | **Take** | Direct precedent for identity→role→unit scoping on the spine. |
| Ticket domain design (status model, comments, `TicketChange` audit, classifiers, assignment) | **Take (simplified)** | Doc 09's light ticket tracker is a deliberately small subset of this proven shape — we know what it grows into. |
| News/announcements domain (scoping, read tracking, templates) | **Take (simplified)** | Doc 09's announcements; scoping-by-project replaces its property scoping. |
| `SendMessageService` channel abstraction | **Take** | Confirms doc 11's design: one send seam, many channels, per-user settings, blacklists. |
| Payment `AmountDistribution` + `paymentSplitter` (split one payment across recipients with fee rules) | **Take (study)** | The closest existing thing to our commission/NOI-split ledger math (doc 10); study the algorithm, re-express over our ledger. |
| Integration-context pattern (Integration + per-org Context + AccessRight) | **Take** | How doc 14 models the licensed payment provider and OTA channels as pluggable, org-scoped integrations. |
| i18n JSON-key architecture (`packages/locales`) | **Take (pattern)** | Validates the content-key model; ours adds TH, DB storage, and founder editing (doc 05). |
| KeystoneJS runtime, GraphQL layer, admin-ui, werf/NATS/Helm infra, mini-app platform | **Don't take** | Welded to Keystone and heavy multi-tenant SaaS operations; conflicts with the modular-monolith target and would make cheap-model building fragile. |
| RU-specific billing (TIN/BIC, receipt QR), meters, insurance/callcenter satellites | **Don't take** | Wrong country, wrong scope. |
| Booking/reservations, TM30/immigration, engagement-type economics | **Absent — greenfield** | condo assumes permanent residents; serviced-living stays and Thai compliance don't exist in it. |

## 3. `phuket-flea-market-e90916d2` — "SALA" (Lovable-generated flea-market SPA)

**What it is.** A small Vite + React + Supabase SPA for second-hand goods in Phuket: listings feed with chip filters, listing CRUD with multi-image upload, 1:1 realtime chat, profiles, and a hand-rolled **EN/RU/TH i18n layer (~258 keys)**. Mobile-first, shadcn/ui, clean look. Effectively an unfinished MVP: no payments (monetization cards are static copy), no moderation, near-zero tests, `any`-typed data layer, N+1 queries.

**Decisions.**

| Piece | Decision | Why / how it maps |
|---|---|---|
| Feed UX (chip filters, skeletons, 2-col mobile grid, post-in-one-form with inline photos) | **Take (as UX reference)** | The best in-house reference for “a feed, not a form” and “post in seconds” (model v3 §24.5) when the home-space marketplace is built (post-first-loop). |
| EN/RU/TH key structure and its Phuket-audience translations | **Take (as seed material)** | Exactly our three languages; mine the key naming and existing TH strings as seeds for doc 05 namespaces. |
| Realtime chat shape (per-listing thread, realtime publication) | **Reference only** | Doc 09's threads are participant-scoped on the spine, not listing-scoped; the Airbnb clone's SSE pattern is the stronger base. |
| Supabase coupling, `any`-typed data layer, boolean `is_verified_seller` | **Don't take** | We own our Postgres; verification must scale to stakes, not a flag. |

## 4. `airbnb-price-optimizer-rio` — Python ML pricing pipeline (Rio de Janeiro)

**What it is.** A genuinely well-built ML pipeline (Airflow, DVC, XGBoost/LightGBM, MLflow, FastAPI, Streamlit) that learns price elasticity per neighbourhood×room-type from Inside-Airbnb Rio snapshots and computes revenue-optimal prices. Real tests, real docs (Portuguese), live deployment scaffolding.

**Decisions.** **Don't take (first loop); keep as a future reference.** myUNO's first-loop pricing is deliberately **configuration-driven** (rate bands, season calendar, markups — doc 04), not learned: we won't have the data volume, and editable-by-the-founder is the requirement. The elasticity → revenue-optimal-price engine (`src/features/demand.py`) and Holt-Winters seasonality are the right *ideas* for a phase-2 dynamic-pricing module once our own operating dataset exists (doc 13 captures the data for it from day one). Everything is Rio-hardcoded; nothing is drop-in.

## 5. `MyCommand-center` — Android founder cockpit (AI Studio-generated)

**What it is.** A native Kotlin/Compose personal app for the founder: dashboards, kanban, decision log, risk register, and eight hardcoded Gemini "cofounder" personas (STAYS, DEALS, marketplace, CFO, compliance…). Two commits, boilerplate tests, prototype state.

**Decisions.** **Don't take (code: platform mismatch, Android vs web; prototype quality).** Two harvests noted for later: its **scorecard field taxonomy** (a 27-field KPI dictionary — MRR, GMV, occupancy, margins) informs the analytics catalog in doc 13 and the founder dashboard; its persona split mirrors the module boundaries we define anyway. Nothing else transfers.

## 6. `geo-seo-claude` — GEO/SEO toolkit (third-party fork)

**What it is.** A fork of an MIT-licensed Claude-Code skill package for auditing and optimizing sites for AI search engines: 14 sub-skills, JSON-LD templates, llms.txt generation, scoring scripts. Third-party work (upstream is actively maintained); a consulting toolkit, not platform code.

**Decisions.** **Keep as external tooling; don't wire in.** After the public pages (doc 08) ship, run its audits against them. Its **JSON-LD templates** (`schema/local-business.json`, `organization.json`, `website-searchaction.json`) are adaptable starting points for myUNO's structured data — doc 08 specifies structured data on the landing/project pages with these as the reference.

## 7. `myUNO-PMS-OS` — empty

A repository containing only a title README. **Nothing to take.** Noted so the audit is complete; the name suggests it was reserved for a PMS attempt that never started.

## 8. `awesome-system-design-resources` — public learning repo

A third-party collection of system-design study links and diagrams. **Not legacy code; nothing to take.** Useful reading, irrelevant to the audit.

---

## 9. Synthesis — what the parts bin gives the build, and what it cannot

**Covered by proven legacy patterns (re-implement, don't import):**
booking engine with holds and overlap logic; anti-tamper server pricing; provider-agnostic payment seam with mock mode; cancellation/refund computation; date-change/modification; SSE messaging + read receipts; typed notifications with channel seam; email templates; auth with hashed one-time tokens; upload seam; granular role-permission-as-data (condo); tickets, announcements, marketplace shapes (condo); payment splitting (condo); i18n-as-keys (condo + SALA, incl. TH seed strings); mobile-first feed UX (SALA).

**Greenfield — no legacy piece exists, specs must carry full weight:**
1. **The spine itself** — project → unit → identity → roles with engagement types; every legacy model is flat.
2. **TM30 / Thai compliance rail** — nowhere in any repo.
3. **Owner economics** — NOI ledger, `MIN(NOI, cap)` statements, engagement-type-driven commissions (condo's splitter is arithmetic inspiration only).
4. **The three editable layers** — DB-backed content keys with founder editing, typed configuration with per-project overrides, and the new design system.
5. **The project home space** rendered per role, with the portfolio overlay and project switcher.

**Consequence for the stack (argued fully in doc 01):** the Airbnb clone proves Next.js + TypeScript + Prisma + PostgreSQL end-to-end in this team's hands, and every take-decision above re-implements cleanly on it. condo argues *for patterns*, not for adopting Keystone. Doc 01 therefore locks the modular monolith on the proven stack.

*Sources: repository inspection of the eight repos listed above; `My-Airbnb-Clone-Copy/CLAUDE.md`; condo's domain schemas under `apps/condo/domains/`; SALA's `supabase/migrations` and `src/lib/i18n.tsx`; the optimizer's `src/features/demand.py`.*
