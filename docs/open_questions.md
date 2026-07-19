# Open Questions — the running register

Anything a scenario needs that the specs don't yet cover is logged here and **asked, never invented**. Each entry says where it came from, what is blocked, and — where the specs had to proceed — what **provisional, clearly-marked assumption** was written down so the founder can confirm or overturn it. Provisional answers are always the *safest, most reversible* reading, and are also marked `⚠ provisional` at the point of use in the spec.

Status legend: **OPEN** — needs the founder's call · **PROVISIONAL** — a marked assumption is in the specs pending confirmation · **ANSWERED** — resolved, folded into the specs.

**Answered so far (2026-07):** Q4, Q6, Q7, Q8, Q10, Q11, Q12, Q13, Q16, Q17, Q18. **Still open:** Q1, Q2, Q3, Q5, Q9, Q14, Q15, Q19, Q20, Q21 (crypto), Q22 (international payouts).

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

### Q23. Chinese (中文) locale — OPEN
- **Source:** the founder's landing v3 (myunolandingv3.html) ships full EN/RU/**ZH** copy, but the platform's locale enum (doc 05, schema `Locale`) is ru/en/th only.
- **Blocks:** nothing — the ZH copy is preserved in the landing file; the platform pages adopted its EN + RU.
- **Needs from founder:** whether 中文 becomes a fourth platform locale (schema enum change + fallback-chain position), or stays a marketing-site-only language.

### Q24. Landing v3 marketing elements — OPEN
- **Source:** landing v3 contains lead-gen machinery (early-access form, founding terms, call-with-Pavel CTA, owner-record mockup, earnings-calculator teaser) that belongs to the marketing site, not the product app. Its owners/developers narrative copy **was** adopted into the audience pages (T1-AUD).
- **Needs from founder:** where the marketing site lives (separate static page vs routes in the app), and whether the "What could my unit earn?" calculator becomes a product feature.

---

*Maintained by Fable. New gaps found while walking journeys are appended; nothing is silently invented.*
