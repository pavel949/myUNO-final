# Open Questions — the running register

Anything a scenario needs that the specs don't yet cover is logged here and **asked, never invented**. Each entry says where it came from, what is blocked, and — where the specs had to proceed — what **provisional, clearly-marked assumption** was written down so the founder can confirm or overturn it. Provisional answers are always the *safest, most reversible* reading, and are also marked `⚠ provisional` at the point of use in the spec.

Status legend: **OPEN** — needs the founder's call · **PROVISIONAL** — a marked assumption is in the specs pending confirmation · **ANSWERED** — resolved, folded into the specs.

**Answered so far (2026-07):** Q4, Q6, Q7, Q8, Q10, Q11, Q12, Q13, Q16, Q17, Q18. **Still open:** Q1, Q2, Q3, Q5, Q9, Q14, Q15, Q19, Q20, Q21 (crypto), Q22 (international payouts), Q32 (service-fee rate), Q34 (provider take rate), Q35 (audience FAQ copy), Q36 (terms + privacy prose).

---

## A. Inherited from the business model (Appendix A of v3) — founder's call

### Q1. Where does buyer revenue book — Estate or Capital? — OPEN
- **Source:** Model v3, Appendix A.1.
- **Blocks:** nothing in the first loop's build. The platform captures the guest→buyer **signal** (doc 13) and hands off; where the fee books is an accounting/entity decision.
- **Spec stance:** docs 13/10 treat buyer revenue as **off-platform (Capital-led)**; the platform records the signal and the referral, not the transaction.

### Q2. The complex commercial model (transformation fee vs revenue share vs JV) — OPEN
- **Source:** Model v3, Appendix A.2.
- **Blocks:** nothing first-loop (whole-complex onboarding is phase 2 by design). Configuration (doc 04) reserves a `complex.*` parameter group so the decision lands as config, not code.

### Q3. Are services operated or referred? — PROVISIONAL
- **Source:** Model v3, Appendix A.3. A real fork on the highest-frequency revenue line; the founder keeps it open for now.
- **Provisional stance in the specs:** the service-order flow (docs 07/09/10) is designed **referral-first for fulfilment**: the provider fulfils and bears service liability; myUNO takes a configurable take-rate (`services.take_rate_pct`). Payment, however, runs through the platform's checkout in both modes (one checkout, one refund rail — doc 10 §3), with the provider's share remitted on a payout cadence. The per-service `fulfilment_mode` field (`referred` / `operated`) makes switching any category to operated a configuration change, not a redesign.
- **Needs from founder:** confirm referral-first, and which categories (if any) should be operated in-house from day one.

### Q4. How many projects, and how are they chosen? — ANSWERED (first project) / partial
- **Source:** Model v3, Appendix A.4.
- **Answer (2026-07):** the first project is **The Title Legendary** (Bang Tao, Phuket). The platform is multi-project by architecture; loop one runs in this one project. Its name is set for the per-project landing (`/projects/the-title-legendary`, doc 08 §4). **Structure is laid out; content stays empty until supplied.**
- **Still needed (→ Q20):** the project's unit inventory, brand/photography assets, handbook/house rules, and services/provider catalog.

### Q5. The change-of-class legal answer — OPEN (external, urgent per v3)
- **Source:** Model v3, Appendix A.5 and §29.
- **Blocks:** the complex pitch track only; nothing in the first-loop build. Doc 12 requires per-unit permitted-use confirmation at mobilization regardless.

---

## B. Found by walking the journeys (user_journey_audit.md §4 + Fable's walk)

### Q6. Security deposits under the "no holding funds" rule — ANSWERED (provisional default confirmed 2026-07)
- **Source:** journey audit §4; model v3 §18/§35.
- **Answer:** the design stands — **pre-authorization on the guest's card via the licensed payment provider** where supported, released after check-out inspection; where pre-auth is unavailable, **no deposit is taken** and damage is claimed after the fact against the condition record (doc 07 F-DIS-1), invoiced through the provider. myUNO never holds the funds. Note (doc 10 §7): deposits are **not** taken in cash — cash-held deposits would be fund-holding; cash is for rental/service revenue only. Default remains `booking.deposit.mode=off`, editable per unit.

### Q7. The owner staying in their own unit (resident-guest) — ANSWERED (provisional default confirmed 2026-07)
- **Source:** journey audit §4.
- **Answer:** the owner **books their own unit like a guest at zero rent** — the `owner_stay` booking type (doc 07 F-OWN-6): blocks the dates, shows in occupancy flagged `owner_stay` (excluded from revenue-occupancy), no rent, no commission; consumed services and the turnover clean appear on the owner statement. Defaults stand: `owner_stay.charge_cleaning=true`, `owner_stay.notice_hours=48`.

### Q8. Payment methods for the first loop — ANSWERED (direction set 2026-07)
- **Source:** doc 10; the legal rule only says "licensed", v3 left the method open.
- **Answer:** **cash is a first-class payment method** and the primary rail for the Russian-speaking clientele in loop one. A cash booking/order carries `payment_method=cash` and records **who accepted it, when, and the receipt/чек number** (doc 02 §5.1); cash participates fully in the **owner statement and reconciliation** (docs 10, 13). Card and Thai payment methods run through the provider seam — **default licensed provider Opn (Omise)** — kept behind the mock adapter until integrated. **Crypto is explicitly not accepted** (a licensed activity, SEC/BOT — same class as FX and fund-holding) — logged as Q21, not built as a feature.
- **Still needed:** confirm Opn/Omise commercial terms when card acceptance is switched on.

### Q9. WhatsApp / Telegram sending — which sender identity and when? — OPEN
- **Source:** doc 11 lists WhatsApp/Telegram as channels; sending requires a WhatsApp Business API number / Telegram bot.
- **Provisional stance:** loop one ships **email + in-app** as the delivered channels; WhatsApp/Telegram are specified (triggers, templates, keys) but behind the channel seam, off by default (`notify.channel.whatsapp.enabled=false`, `notify.channel.telegram.enabled=false`).
- **Needs from founder:** the WhatsApp Business number / Telegram bot, and which notification types go to messengers first.

### Q10. TM30 filing method — ANSWERED (provisional default confirmed 2026-07)
- **Source:** doc 07 check-in flow; no stable public API for the Immigration Bureau's TM30 e-filing.
- **Answer:** manual-with-tracking stands (doc 07 F-OPS-2) — a TM30-ready record on check-in, a filing task with a 24-hour SLA countdown, staff file at the official portal and record the receipt; unhappy path escalates per config. Staff file under **Ignatev Estate Co., Ltd** (the entity from Q16) and its property registrations. No scraping of the government portal in loop one.

### Q11. Guest identity verification — ANSWERED (provisional default confirmed 2026-07)
- **Source:** doc 07 booking/pre-arrival; the "verified guest" gate in v3 §11.
- **Answer:** loop one = **passport capture pre-arrival** (needed for TM30 anyway) + payment as the financial check; **no third-party KYC vendor**. The "verification failed" path = passport not provided by the deadline ⇒ configurable action (withhold self-check-in, host contacts guest).

### Q12. The cancellation policy defaults — ANSWERED (provisional default confirmed 2026-07)
- **Source:** doc 04 ships a default cancellation policy; v3 says only that it is configuration.
- **Answer:** the three named policies stand (doc 04 §5) — `flexible` (full refund to 24h), `moderate` (full to 5 days, 50% after), `strict` (50% to 14 days, none after), default `moderate`, overridable per project/unit; service orders full-refundable to `service.cancel_window_hours` (24h) before the slot, provider no-show always full refund. All editable in the admin panel at any time.

### Q13. Seasons for pricing — ANSWERED (2026-07)
- **Source:** doc 04 rate bands need date ranges; v3 gives none.
- **Answer:** the pricing grid is **fully flexible** — **any number of named price periods** (including a *shoulder* season), every date range and markup percentage **editable in the admin panel**, per project and per unit. No fixed set of three seasons. doc 04 §4 is revised to a general season list; Phuket-conventional periods ship only as an editable starting example, not a constraint.

### Q14. Commission numbers — the actual defaults — OPEN (working on provisional defaults)
- **Source:** doc 04. v3 gives formulas (owner = MIN(NOI, cap); MC fee 10–15%; services take-rate) but not numbers.
- **Provisional stance (doc 04 §3, all editable):** `engagement.direct.noi_cap_annual_thb` — **no default; set per unit at mobilization**. `engagement.via_mc.platform_fee_pct = 12`. `engagement.owner_direct.booking_fee_pct = 10`. `services.take_rate_pct = 15`. Setup fee `0`.
- **Needs from founder:** the real numbers for The Title Legendary's mandates.

### Q15. The Ombudsman credential — how is it shown? — OPEN
- **Source:** docs 08 (trust pages) and positioning.
- **Needs from founder:** the exact credential text/assets legally publishable (content keys `trust.ombudsman.*` reserved and empty).

### Q16. Legal entity and PDPA controller — ANSWERED (2026-07) / partial (some public assets)
- **Source:** doc 08 footer/legal pages; doc 12 (controller identity under PDPA).
- **Answer:** operating entity and **PDPA data controller** = **Ignatev Estate Co., Ltd** · DBD registration **083-5-56602358-7** · registered address **Plaza Del Mar, No.1 Pasak-Koktanod Rd, office 115–116, Cherngtalay, Thalang, Phuket 83110** · director **Pavel Ignatev** · **pavel@ignatevestate.com** · **+66 92 240 7355**. Folded into doc 08 (footer/terms/privacy content facts) and doc 12 (controller). 
- **Still needed:** Ignatev Capital's entity details if it is named publicly; any license references for the trust page (relates to Q15).

### Q17. Owner statement cadence and sign-off — ANSWERED (provisional default confirmed 2026-07)
- **Source:** doc 07 F-FIN-1; v3 §13 says "periodic" and "sign-off gate" without cadence.
- **Answer:** **monthly** statements, generated on the 5th of the following month, admin reviews and publishes (the sign-off gate); owner is notified and sees it in the portfolio. `finance.statement.day_of_month=5`, `finance.statement.requires_admin_signoff=true`. Payout is recorded after publication (loop one manual — Q18).

### Q18. Owner payouts — ANSWERED (THB 2026-07) / international deferred
- **Source:** doc 10 §6.
- **Answer:** loop-one owner payouts are **THB bank transfers**, executed manually, from **Bank of Ayudhya (Krungsri) account 475-1-22131-3, SWIFT AYUDTHBK**; the platform records each payout (amount, date, reference) against the published statement. Recorded as `finance.payout.default_thb_account` (doc 04 §7).
- **Deferred → Q22:** international / non-THB owner payouts.

### Q19. RU / EN / TH — default locale, and who translates TH? — OPEN (provisional default in place)
- **Provisional stance (doc 05):** default locale **RU** (the clientele), user-switchable; EN complete at launch; TH keys exist from day one but may lag — fallback chain requested → EN → RU → visible key. Founder edits all three in the admin content editor.
- **Needs from founder:** confirm RU default; who produces TH strings (staff, translator, or machine-translate-then-review — the editor supports a "needs review" flag).

### Q20. Real content for the first project & services catalog — OPEN
- **Source:** docs 07/08/09 reference The Title Legendary's amenities, rules, services and providers; the specs define the **structures and keys**, not the actual content.
- **Needs from founder:** the project's handbook, house rules, amenity list, initial provider list (transfer, cleaning, chef, …) with terms, and photography.

### Q21. Crypto acceptance — OPEN (deferred by decision 2026-07)
- **Source:** founder direction, via Q8.
- **Decision:** crypto is **not** an accepted payment method — accepting it is a licensed activity (SEC/BOT), the same class as operating FX or holding funds. Not built, not surfaced. Logged as an explicit future **legal** decision, not a missing feature.
- **Needs from founder (only if ever revisited):** the licensed route (a regulated on-ramp/exchanger as a channel, never in-house).

### Q22. International (non-THB) owner payouts — OPEN (future)
- **Source:** Q18 follow-on; many owners are abroad.
- **Blocks:** nothing in loop one (THB payouts to the Krungsri account cover it).
- **Needs from founder:** the intended rails for paying owners abroad, resolved with counsel — always FX-routing-to-a-licensed-exchanger, never operated in-house (AMLO).

### Q23. Chinese (中文) locale — ANSWERED (2026-07, Layantara onboarding)
- **Source:** the founder's landing v3 ships full EN/RU/**ZH** copy; the Layantara brief demands EN/RU/中文 from day one.
- **Answer:** 中文 is a **full fourth platform locale** (founder decision 2026-07-28, LY-3). Fallback `zh → en → ru → th`; the switcher, content editor, and CSV all carry zh. Policy (doc 05 §2): public guest-facing namespaces get zh drafts (`needs_review` until edited); admin/ops surfaces intentionally serve EN via fallback.
- **Still needed:** editorial review of the machine-drafted zh strings; zh brand renderings (myUNO, Layantara, Ignatev Estate in 中文) — LY-4 open item.

### Q24. Landing v3 marketing elements — OPEN
- **Source:** landing v3 contains lead-gen machinery (early-access form, founding terms, call-with-Pavel CTA, owner-record mockup, earnings-calculator teaser) that belongs to the marketing site, not the product app. Its owners/developers narrative copy **was** adopted into the audience pages (T1-AUD).
- **Needs from founder:** where the marketing site lives (separate static page vs routes in the app), and whether the "What could my unit earn?" calculator becomes a product feature.

### Q25. Project landing FAQ content — OPEN
- **Source:** doc 08 §4 (S2) lists a FAQ section on the per-project landing `/projects/{slug}`. The page is built (L1) with hero, availability, units grid, story, amenities, services, location, handbook teaser, and trust band — but FAQ questions and answers are project-specific content that doesn't exist yet.
- **Blocks:** nothing — the page ships without the FAQ section; it appears once content exists.
- **Needs from founder:** the actual FAQ entries for the first project (or a shared template set), supplied as `project_page.faq.*` keys in the content editor. Ties into Q20 (real content for the first project).

### Q26. Locale-in-URL routing (hreflang) — OPEN
- **Source:** doc 08 §7 asks for canonical + `hreflang` triplets. The platform's locale is a **cookie**, not a URL segment, so every locale serves the same URL — `hreflang` is meaningless until locale-prefixed routes (`/ru/…`, `/en/…`, `/th/…`) exist. The L2 SEO layer shipped canonical tags, sitemap, robots.txt, llms.txt, and JSON-LD (Organization on home, LodgingBusiness per project); `hreflang` is the one §7 item that needs this structural decision. Unit-page `Product`+`Offer` JSON-LD also waits — the unit detail renders client-side today.
- **Needs from founder:** whether to move to locale-prefixed URLs (an SEO win for RU/EN/TH search, but every link and redirect changes) — and if so, when.

---

### Q27. Dead data-model surface — build or remove? — OPEN
- **Source:** the data-model audit (DM vertical). Several schema tables have no working feature behind them: `AuthAccount` (Google/Apple login never wired), `ProviderProject` (provider service-area scoping), `ServiceMedia` (service photo galleries), and `TicketMedia`/`ProjectMedia` have read paths but no upload paths (ticket photo evidence and project galleries cannot be created). Passport *image* upload also doesn't exist yet — when it is built, the file bytes must be encrypted and `MediaAsset.encrypted` set (the field-level encryption of passport numbers/names/DOB landed in DM-1).
- **Blocks:** nothing in loop one.
- **Needs from founder:** which of these become real features in loop two (OAuth login, provider service areas, service galleries, ticket photos, project gallery uploads) and which get removed from the schema. Also two spec'd shapes that still need building decisions: `MessageMedia` (message photo attachments, doc 02 §7.1) and quote-model service orders (no `quote_requested` lifecycle state exists — doc 02 §4.3).

### Q28. Layantara tariff edges — discount stacking & monthly rates beyond low season — OPEN (provisional defaults in place)
- **Source:** the Layantara onboarding brief (LY-2). The brief gives three tariffs (standard / early-bird 60+ days −8% / long-stay monthly) and monthly prices only "from low season" (2BR 72,000 · 3BR 115,000 · Grand Deluxe 140,000 THB/mo).
- **Provisional rules built:** (1) the flat monthly rate applies to stays ≥ 28 nights when **every** covered season has a monthly price, and it **replaces** the LOS discount and early-bird (no stacking); (2) early-bird **does** stack with the weekly LOS discount (sequential: LOS first, then early-bird on the remainder); (3) a long stay crossing a season without a monthly price falls back entirely to the nightly + LOS path.
- **Needs from founder:** monthly prices for shoulder/high/peak (or the rule for stays crossing them); confirm the no-stacking rules; confirm 14+ nights long-stay tier from the brief (built: weekly ≥ 7 / monthly ≥ 28 — is a separate 14+ tier needed?).

### Q29. Layantara — real-world facts for the seeded structure — OPEN
- **Source:** the Layantara onboarding brief (LY-4). The structure, categories, and the full tariff grid are seeded; these facts are placeholders until supplied:
- **Needs from founder:** (1) real villa numbers/names for the 39 villas (seeded as `P1-01…07`, `P2-01…24`, `G-01…08` — editable per unit in the admin panel); (2) the **hotel licence number** for the public trust block (`project.layantara.licence` shows the claim without the number; `permittedUseConfirmedAt` was set at seed on the strength of the stated licence); (3) the exact map pin (seeded ≈ Layan Beach 8.0106, 98.2965); (4) photography (upload via admin → units / project cover); (5) concierge service prices & terms (floating breakfast, yacht, transfer, shuttle, grocery pack — seeded on the quote model, never charging a number until priced); (6) the beach-shuttle schedule (content key, LY-7); (7) villa bathroom counts / max guests per category (seeded 2BR→2BA/4 guests, 3BR→3BA/6 guests); (8) zh (中文) brand renderings for myUNO / Layantara / Ignatev Estate.

### Q30. Quote-priced service orders — the in-thread quote flow (SA-3) — OPEN
- **Source:** the super-app services vertical (SA-2). Today a quote-priced service (yacht, chef, grocery pack) hands the guest to the concierge (project WhatsApp / in-app messages); the order API refuses quote orders by design. Doc 07 F-SVC-2 specifies the full loop: request → provider quotes in-thread → orderer accepts → pays against the quote.
- **Needs from founder:** (1) should the quote live as an order status (`quote_requested → quoted → accepted`, a small schema change) or as a thread message the admin converts to a priced order manually (no schema change, loop-one style)? (2) who sets the price — the provider in their portal, or only admin/concierge? (3) does a quoted price expire (hours/days)? Until ruled, the concierge hand-off stands.

### Q31. Owner-statement line items exist in the database but not in the schema — adopt or drop? — RULED: adopt the full reporting model
- **Source:** the migration-chain repair. Migration `20260813000010_owner_reporting_and_transparency` creates a `statement_line_item` table (with a `LineItemCategory` enum, and foreign keys to `owner_statement` and `booking`) and adds twelve reporting columns to `owner_statement`: `gross_bookings_amount_thb`, `guest_payments_received_thb`, `service_fees_amount_thb`, `operating_expenses_amount_thb`, `taxes_amount_thb`, `adjusted_noi_thb`, `distributable_cash_thb`, `performance_fee_amount_thb`, `performance_fee_basis_text`, `signed_off_by_owner_at`, `signed_off_by_operator_at`, `approved_at`. **None of them exist in `prisma/schema.prisma`**, so the Prisma Client cannot read or write any of it — the structures are inert.
- **Why this matters:** CLAUDE.md ("Fee Transparency for Owners") requires exactly these on every monthly statement — gross bookings, service fees, expenses, adjusted NOI, distributable cash, performance fee — plus line-item drill-down tracing each line to its booking, receipt, or fee contract. The database is ready for it; the application cannot reach it. A test at `src/app/api/admin/statements/__tests__/generate.integration.test.ts` already imports a `[statementId]/line-items/route` that was never written, so the feature was started and left mid-way.
- **What was done meanwhile:** the repair deliberately did **not** drop them. `prisma migrate diff` proposed dropping all thirteen structures to match the schema; every column is nullable and the table is standalone, so keeping them costs nothing and Prisma ignores what it does not declare — whereas dropping them would destroy owner-reporting data with no way back. This leaves one known, documented schema/database difference.
- **The test suite already assumes the richer model.** `src/app/api/admin/payouts/payouts.integration.test.ts` builds an `ownerStatement` from `grossBookingsAmountThb`, `serviceFeesAmountThb`, `adjustedNoiThb`, `distributableCashThb` and `status: 'signed_off'` — none of which the current model has — while omitting `engagementId`, `grossRevenueTh`, `noiTh`, `ownerShareTh` and `estateShareTh`, which it requires. So the migration, the missing route and these tests are all consistent with **one** earlier design of `OwnerStatement` that never reached `schema.prisma`. This is the biggest single cause of the 17 failing tests currently keeping CI red; they cannot be fixed by adjusting fixtures, because which model is correct is the open question.
- **Founder ruling (16 Aug): adopt the full reporting model.** `schema.prisma` now declares `StatementLineItem`, the `LineItemCategory` enum, the twelve `OwnerStatement` reporting fields, and the three appended statuses (`pending_owner_review`, `signed_off`, `distributed`). The schema and the database now agree exactly — `prisma migrate diff` reports no difference in either direction, and the reconciliation migration no longer needs to drop anything.
- **Still to build, tracked separately:** statement generation populating the reporting fields and writing line items, the line-items endpoint grouping by category, the sign-off endpoint, and the integration tests that describe all three (which are written against a Prisma Client API that does not exist — they use snake_case field names — so they need rewriting, not patching). The service-fee rate those tests assume is 12%, which is **not** a registered parameter yet; per CLAUDE.md it must become one in doc 04 rather than a literal in the route, and the rate itself needs confirming.

### Q32. The service-fee rate on owner statements — OPEN (⚠ provisional 12%)
- **Source:** building the owner-statement reporting model after Q31 was ruled. Every statement now carries a `service_fees_amount_thb` line, and the rate behind it had to come from somewhere. The integration test describing the feature assumed 12%, which appears to have been carried over from a different codebase rather than decided here.
- **Built:** a registered parameter `finance.statement.service_fee_pct` (percent, group `finance`, scopeable to unit → project → global), default **12 ⚠**, documented in doc 04 §7. It is read through `config.get()`, never as a literal, so changing it is an admin edit and not a code change. The same commit also removed a hard-coded 15% management-fee literal that the old generation route carried.
- **Needs from founder:** the real rate, and whether it differs by engagement type (direct-managed / via management company / owner-direct) or by project. Until ruled, 12% stands and every statement records the basis it used.

### Q33. Owner sign-off sits on an admin route — ANSWERED (split in two, 16 Aug) — built
- **Source:** the sign-off endpoint built for Q31. It lived only at `PUT /api/admin/statements/{id}/sign-off` and took `{actor: 'owner' | 'operator'}`. The operator side was admin-only; the owner side accepted the statement's own owner, or an admin recording it on their behalf.
- **Why it was a question:** everything else an owner does sits under `/api/owner/…`, and CLAUDE.md scopes visibility by role. An owner calling an `/api/admin/` path is inconsistent even though the check itself was correct.
- **Answer: both doors, one lock.** Owner sign-off moved to **`PUT /api/owner/statements/{id}/sign-off`** — owner-only, no body, scoped in the query to the caller's own statement. The **admin route stays exactly as it was**, for the operator (myUNO) signature *and* for an admin recording an owner's signature taken offline; the cash-first, Russian-speaking clientele of CLAUDE.md still signs on paper, and deleting that path would strand those statements.
- **Built:** the state machine now lives once, in `src/modules/finance/statement-signoff.service.ts` (`getStatementSignOffState` · `hasSignedOff` · `recordStatementSignOff` · `OWNER_VISIBLE_STATEMENT_STATUSES`), exported through `@/modules/finance`. Both routes authorize in their own way and then write through it, so the two signatures, the `pending_owner_review` transition and the `signed_off` + `approvedAt` close can never drift apart. Covered by `src/app/api/owner/statements/[statementId]/sign-off/__tests__/sign-off.integration.test.ts` (owner signs · another owner 404s · draft 404s · second signature 409s · owner-after-operator closes the statement · the admin route's operator and offline-owner paths still work).
- **Noticed while building, then closed:** the owner dashboard's statement list (`getOwnerStatements`, `src/modules/projects/owner.service.ts`) still filtered to `status: 'published'`, so a statement sitting at `pending_owner_review` — the one actually waiting on the owner's signature — was reachable by link but never listed. That left sign-off with no route through the interface at all, which is a broken flow rather than a matter of taste, so the list now reads the same `OWNER_VISIBLE_STATEMENT_STATUSES` as the detail page and the sign-off routes. Drafts stay hidden. Guarded by tests in `src/modules/projects/owner.integration.test.ts` ("lists every statement past the admin gate, and hides drafts"), so the three surfaces cannot drift apart again.
- **One rule this forced, worth the founder's eye:** an owner may open and sign a statement in any status **except `draft`** — a draft has not passed the admin sign-off gate (doc 10), so it is not the owner's to read, and an owner cannot sign what they cannot see. `superseded` statements stay visible, labelled as such, on the reasoning that hiding a statement an owner has already been shown is the opposite of an audit trail. Overturn either half and the constant `OWNER_VISIBLE_STATEMENT_STATUSES` is the single place to change.

### Q34. Two provider-remittance calculations disagree about the take rate — OPEN
- **Source:** repairing the finance test suite. `computeProviderRemittance` exists twice. `src/app/libs/payouts.ts` deducts the take rate; `src/modules/finance/payout.service.ts` returns `takeRateTotal: 0` and computes `net = total − refunds`, omitting it. Doc 10 §5 specifies `fulfilled orders − take-rate − refunds`, so the module version underpays myUNO — or overpays the provider — depending on which one a caller reaches. The module version also counts `accepted` orders alongside `fulfilled`, which doc 10 does not.
- **Why it was not simply fixed:** no test failed on it, and both the take-rate treatment and whether an accepted-but-unfulfilled order is remittable are money-policy calls. Guessing either would put real THB on the wrong side of a provider settlement.
- **Needs from founder:** confirm doc 10 §5 as written (fulfilled only, take rate deducted), after which the two implementations should be collapsed into one — a single calculation is the point, since two can always drift apart again.

### Q35. Five of the six audience pages have no FAQ copy — OPEN
- **Source:** building T-035's structured-data layer. Doc 08 §3 puts an FAQ accordion in the audience-page template, and doc 08 §7 requires `FAQPage` JSON-LD on it. Only **owners** has founder-written FAQ content (eight questions, seeded and rendered). `guests`, `developers`, `buyers`, `management-companies` and `providers` have no `audience.*.faq.*` keys at all — none seeded, none rendered.
- **Why it was not simply written:** an FAQ is where a prospect's sharpest questions get answered — what it costs, what is legal, who is liable, whether this is live. Drafting those answers for five audiences would be inventing commercial and legal positions, which is exactly what CLAUDE.md forbids. The owners FAQ reads like the founder wrote it, and the others should match that voice rather than an agent's.
- **Built anyway:** the mechanism, not the content. `faqPageJsonLd()` (`src/lib/seo.ts`) builds the graph from whatever answered pairs a page passes it, drops entries whose question or answer is blank, and returns null when nothing is answered — so a page with no FAQ emits no FAQ graph rather than an empty promise. The owners page uses it today; the other five pick it up the moment their copy exists, with no further code.
- **Needs from founder:** the FAQ questions and answers for guests, developers, buyers, management companies and providers — or a ruling that some audiences do not get an FAQ at all.

### Q36. The terms and privacy prose is unwritten — OPEN (entity facts published, policy body pending)
- **Source:** T-035. `/legal/terms` and `/legal/privacy` were stubs: a heading in hard-coded English and nothing else — no entity details, no PDPA controller line, though doc 08 §2 says the Q16 facts populate exactly these two pages and the footer.
- **Built:** both pages now render from `legal.*` content keys and carry the `LegalEntityBlock` — operating entity, DBD registration, registered address, director, email, phone — with the privacy page naming that entity as the **PDPA data controller** (doc 12) and listing the access / correction / deletion / withdraw-consent rights, including the carve-out that records kept for financial or immigration compliance are anonymised rather than deleted. Each page carries a plainly worded notice that the full document is being prepared with counsel.
- **Why the body was not drafted:** terms of service and a privacy policy are counsel's instruments and carry legal consequence. An agent-written approximation that reads authoritative is worse than an honest "not yet" — visitors would rely on it, and PDPA exposure attaches to what is published.
- **Needs from founder:** the counsel-drafted terms of service and privacy policy. Also still outstanding from Q16: a dedicated public support/WhatsApp line and a privacy mailbox if different from the director's email, and Ignatev Capital's entity details if it is named publicly.

### Q37. The database sits in Mumbai, but the deployment spec and the privacy notice say Singapore — OPEN
- **Source:** connecting the app to Supabase. Doc 15 §2 specifies **Singapore** for the managed Postgres: closest to Phuket users, and named in the privacy notice as where personal data rests (PDPA). The provisioned project `MyUno- final` (`burcnghheyzbzffzgmjz`) is in **`ap-south-1` (Mumbai)**.
- **Why it is not just a latency question:** under the PDPA the privacy notice tells data subjects where their personal data is held. Passports, payment records and guest identities would rest in a country the published notice does not name. That is a disclosure problem before it is an engineering one.
- **Why deciding now is cheaper:** the database is currently empty. Moving regions is a dump-and-restore today; once there are real guests, bookings and encrypted passports it becomes a migration with downtime, and the `ENCRYPTION_KEY` must travel with it intact or every passport becomes unreadable (doc 15 §4).
- **Needs from founder:** either (a) re-provision in Singapore (`ap-southeast-1`) and point `DATABASE_URL` at it, or (b) rule that Mumbai is acceptable — in which case doc 15 §2 and the privacy notice copy (`legal.privacy.*`, Q36) must both be corrected to name it, and counsel should confirm the disclosure reads correctly.
- **Not decided by an agent:** this trades a compliance statement against convenience, which is a founder call.

---

*Maintained by Fable. New gaps found while walking journeys are appended; nothing is silently invented.*
