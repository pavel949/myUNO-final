# 13 · Analytics & Signals — what is measured from day one

**What this document is.** The measurement layer: the metrics that run the business (occupancy, revenue), the event catalog captured into `AnalyticsEvent` (doc 02 §9.1), and the **guest→buyer signal** the whole model compounds on. Loop one's analytics are *operational and proprietary* — the operating dataset that becomes the due-diligence moat (v3 §7) and the developer demo (v3 §34) — not marketing-pixel analytics.

**Principles.** Events are append-only facts with entity dimensions, no PII in payloads (doc 12); metrics are **computed from the system of record** (bookings, ledger) — the event stream adds behavior, never replaces truth; every metric below states its formula so two screens can never disagree.

---

## 1. Core metrics (formulas)

| Metric | Formula | Where shown |
|---|---|---|
| **Occupancy %** | occupied nights ÷ available nights, per unit/project/period. Occupied = nights of `confirmed/checked_in/checked_out/completed` bookings; `owner_stay` nights counted separately (Q7) and excluded from the revenue-occupancy headline; available = calendar nights − maintenance blocks | Owner dashboard, admin, (future) developer view |
| **ADR** (avg daily rate) | rental revenue ÷ occupied nights (guest-paid nights only) | Admin, owner detail |
| **RevPAN** | rental revenue ÷ available nights | Admin (the honest yield number) |
| **NOI per unit** | ledger: revenue entries − cost entries per period (doc 10 §4) | Statements, owner dashboard |
| **Services attach rate** | stays with ≥1 service order ÷ completed stays | Admin (the hidden-pillar tracker) |
| **Services revenue / take** | order totals; take-rate share | Admin finance |
| **Direct-share** | direct-channel booking revenue ÷ all booking revenue | Admin (the OTA-migration gauge, v3 §26) |
| **Repeat-guest rate** | identities with ≥2 completed stays ÷ identities with ≥1 | Admin |
| **Response/SLA health** | median first-response time (threads), TM30 on-time %, ticket SLA hit % | Ops/admin boards |
| **Signal conversion** | signals → reviewed → handed_to_capital counts | Admin signals funnel |

## 2. Event catalog

Naming `domain.action`; every event carries `occurred_at`, actor (identity or anonymous id), and the entity dimensions shown. Builders emit **exactly these** (new events = PR to this table).

| Event | When | Dimensions/payload |
|---|---|---|
| `page.landing_viewed`, `page.project_viewed`, `page.unit_viewed`, `page.audience_viewed` | Public page views | project/unit ids, locale, referrer class (`ota/organic/direct/social`) |
| `search.performed` | F-GUEST-1 executes | filters used, result count, project |
| `search.no_results` | Empty result set | filters (what demand we're missing) |
| `stay.booking_started` | Review screen reached | unit, nights, party, total |
| `stay.booking_requested / .request_approved / .request_declined` | Request path | booking id |
| `stay.payment_succeeded / .payment_failed / .hold_expired` | Payment outcomes | booking, amount, **method (`cash`\|`card_provider`)**, provider, failure class |
| `stay.confirmed / .modified / .cancelled / .checked_in / .checked_out / .completed / .no_show` | Lifecycle | booking, channel, nights, values |
| `stay.extension_requested` | In-stay extension | booking, added nights |
| `service.catalog_viewed / .service_viewed` | Marketplace browsing | category, service, viewer role |
| `service.order_placed / .paid / .accepted / .declined / .fulfilled / .cancelled / .no_show` | Order lifecycle | order, category, provider, role of orderer, value |
| `review.submitted` | Stay/order reviews | target, rating |
| `message.thread_started` | New thread | context type |
| `ticket.raised / .resolved / .sla_breached` | Ticket lifecycle | category, priority, role of reporter, hours-to-resolve |
| `announcement.published / .read` | Announcements | project, audience |
| `owner.statement_viewed / .payout_recorded` | Owner engagement | unit |
| `owner.sell_interest` | F-OWN-5 card tapped | unit — **a strong signal on the supply side** |
| `lead.submitted` | Audience-page forms | audience type |
| `signal.detected / .reviewed / .handed_to_capital / .dismissed` | Buyer funnel (§4) | signal key, strength |
| `auth.registered / .claimed` | Identity creation | source (`direct/ota_import/staff`) |
| `notify.delivered / .failed` | Channel seam outcomes | type, channel |

## 3. Dashboards fed (loop one)

Admin dashboard tiles + finance views (doc 08 §6), owner dashboards (S7), ops SLA boards (S12) — all computed from record + events per §1 formulas. The **developer demo views** (v3 §34: unit lifecycle, project reporting, compliance view) are these same queries scoped to a project — building them later is presentation work, not new measurement, *because* this catalog exists from day one.

## 4. The guest→buyer signal (the loop's exit ramp)

Detectors run on events/records and write `BuyerSignal` rows (doc 02 §9.2), deduped per identity+key while an open signal exists:

| Signal key | Rule (config where marked) | Strength |
|---|---|---|
| `repeat_stay` | Completed stays ≥ `[cfg] analytics.buyer_signal.repeat_stay_threshold` (default 2) | 2; 3 at ≥3 stays |
| `long_stay` | A stay ≥ `[cfg] analytics.buyer_signal.long_stay_nights` (default 28) | 2 |
| `purchase_question` | Staff flag a thread message ("asked about buying") — one tap on the message | 3 |
| `listing_engagement` | ≥3 `page.unit_viewed` outside own stay dates in 30 days (same identity) | 1 |
| `direct_inquiry` | Buyer lead form / `owner.sell_interest` counterpart | 3 |

Funnel: signals land in the admin **Signals** view (new → reviewed → handed_to_capital / dismissed, with notes). Loop one hands off to Capital humanly (Q1); the *measurement* of the hand-off is on-platform so the loop's economics are provable. Owners' sell-interest mirrors into the same view — both halves of Process H's close-the-loop visible in one funnel.

## 5. Implementation notes

One `track(eventKey, dims)` helper server-side (events emitted where the truth changes — in the modules, not the UI); nightly rollup job materializes the §1 metrics into a small `MetricDaily` table (unit × day grain: nights, revenue, orders — an implementation detail of this doc, added to doc 02's build as a derived table) so dashboards stay fast without an analytics stack. No third-party analytics in loop one; the data is the moat and stays home.

### Implementation status (build phase)

**Emitters live today** (10 of the §2 catalog): `stay_confirmed`, `stay_cancelled` (booking service); `stay_checked_in`, `stay_checked_out` (booking service state transitions); `service_order_placed`, `service_order_fulfilled` (service-order service); `service_order_paid` (finance seam — cash record and card confirm both emit it); `service_order_cancelled` (service-order cancel); `page_unit_viewed` (unit detail API — feeds `listing_engagement`); `search_performed` / `search_no_results` (search API). The remaining catalog events are specified-not-yet-emitted; add emitters at the module seams as their features land.

**`MetricDaily` definitions as built** (`src/modules/analytics/rollup.ts`): grain = unit × UTC day. `nightsAvailable` ∈ {0,1} — 1 when the unit existed that day and was occupied or live-and-unblocked; 0 before creation, while not `live`, or under a `BlockedDate`. `nightsOccupied` ∈ {0,1} — any confirmed/checked_in/checked_out/completed booking covering the night (owner stays occupy at zero revenue). Rental revenue is attributed **per night** (booking total ÷ nights), so summing days never double-counts a stay. Backfill: `GET /api/cron/rollup-metrics?from=YYYY-MM-DD&to=YYYY-MM-DD` (CRON_SECRET, ≤400 days per call).

**Read seam**: dashboards read trends only through `getMetricsSeries()` / `getUnitOccupancySparklines()` (`src/modules/analytics/query.ts`) — day or month buckets, weighted occupancy, whole-THB amounts. Current-period headline numbers stay live-computed in their services (they must include today); everything historical comes from `MetricDaily`.
