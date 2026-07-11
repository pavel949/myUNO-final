# Open Questions — the running register

Anything a scenario needs that the specs don't yet cover is logged here and **asked, never invented**. Each entry says where it came from, what is blocked, and — where the specs had to proceed — what **provisional, clearly-marked assumption** was written down so the founder can confirm or overturn it. Provisional answers are always the *safest, most reversible* reading, and are also marked `⚠ provisional` at the point of use in the spec.

Status legend: **OPEN** — needs the founder's call · **PROVISIONAL** — a marked assumption is in the specs pending confirmation · **ANSWERED** — resolved, folded into the specs.

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
- **Source:** Model v3, Appendix A.3. A real fork on the highest-frequency revenue line.
- **Provisional stance in the specs:** the service-order flow (docs 07/09/10) is designed **referral-first for fulfilment**: the provider fulfils and bears service liability; myUNO takes a configurable take-rate (`services.take_rate_pct`). Payment, however, runs through the platform's licensed-provider checkout in both modes (one checkout, one refund rail — doc 10 §3), with the provider's share remitted on a payout cadence. The per-service `fulfilment_mode` field (`referred` / `operated`) makes switching any category to operated a configuration change, not a redesign.
- **Needs from founder:** confirm referral-first for the first loop, and which categories (if any) should be operated in-house from day one (e.g. housekeeping performed by own staff).

### Q4. How many projects, and how are they chosen? — OPEN
- **Source:** Model v3, Appendix A.4.
- **Blocks:** nothing in the build — the platform is multi-project by architecture from day one, and the first loop runs in **one** project. The founder chooses which real project is first (and its name/brand assets for the per-project landing, doc 08).
- **Needs from founder:** the first target project's name, brand assets, unit inventory, and services catalog.

### Q5. The change-of-class legal answer — OPEN (external, urgent per v3)
- **Source:** Model v3, Appendix A.5 and §29.
- **Blocks:** the complex pitch track only; nothing in the first-loop build. Doc 12 requires per-unit permitted-use confirmation at mobilization regardless.

---

## B. Found by walking the journeys (user_journey_audit.md §4 + Fable's walk)

### Q6. Security deposits under the "no holding funds" rule — PROVISIONAL
- **Source:** journey audit §4; model v3 §18/§35. If we never hold funds, how are damage deposits taken and refunded?
- **Provisional stance in the specs (doc 10 §7):** first loop uses a **pre-authorization hold on the guest's card via the licensed payment provider** where the provider supports it, released after check-out inspection; where pre-auth is unavailable, **no deposit is taken** and damage is claimed after the fact against the condition record (photos in/out), invoiced through the provider. myUNO never touches the funds; the provider holds/authorizes them.
- **Needs from founder:** confirm the pre-auth approach; confirm the default deposit amount policy (currently `booking.deposit.mode=preauth`, `booking.deposit.amount_thb=0` i.e. off by default — see doc 04) and whether any unit class requires a mandatory deposit.

### Q7. The owner staying in their own unit (resident-guest) — PROVISIONAL
- **Source:** journey audit §4. Does the owner book it? Free? How does it show in occupancy and the statement?
- **Provisional stance in the specs (doc 07 F-OWN-6):** the owner **books their own unit like a guest but at zero rent** — an "owner stay" booking type. It blocks the dates, appears in the calendar and occupancy reports flagged `owner_stay`, incurs **no rent and no commission**, and any consumed services and the (configurable) cleaning/turnover cost appear as line items on the owner statement. Owner stays are excluded from revenue-occupancy metrics but shown separately, so the statement never hides that the unit was owner-occupied.
- **Needs from founder:** confirm zero-rent (vs. a token internal rate), and whether turnover cleaning after an owner stay is charged to the owner (current default: yes, `owner_stay.charge_cleaning=true`).

### Q8. Which licensed payment provider? — OPEN (gates real payments, not the build)
- **Source:** doc 10 needs a concrete provider to integrate; the legal rule only says "licensed".
- **Spec stance:** doc 10 defines a **provider-agnostic payment seam** (create checkout → webhook confirm → refund via provider API) with a built-in mock mode, exactly the seam pattern proven in the legacy Airbnb clone. Candidates operating licensed in Thailand to evaluate: **Opn (Omise)**, **2C2P**, **Stripe (TH)**, **GB Prime Pay**. Integration is one adapter behind the seam.
- **Needs from founder:** pick the provider (commercial terms, THB settlement account, RU-card acceptance reality for the clientele).

### Q9. WhatsApp / Telegram sending — which sender identity and when? — PROVISIONAL
- **Source:** doc 11 (notifications) lists WhatsApp/Telegram as channels; sending on them requires a WhatsApp Business API number / Telegram bot.
- **Provisional stance:** first loop ships **email + in-app** as the delivered channels; WhatsApp/Telegram are specified (triggers, templates, content keys) but behind a channel seam, off by default (`notify.channel.whatsapp.enabled=false`, `notify.channel.telegram.enabled=false`) until the founder provisions a WABA number / bot.
- **Needs from founder:** the WhatsApp Business number and Telegram bot decision, and which notification types must go to messengers first (booking confirmations and check-in instructions are the obvious candidates for this clientele).

### Q10. TM30 filing method — manual with system support, or integrated? — PROVISIONAL
- **Source:** doc 07 check-in flow; there is no stable public API for the Immigration Bureau's TM30 e-filing.
- **Provisional stance (doc 07 F-OPS-2):** the platform produces a **TM30-ready record** (passport data, arrival date, unit address) the moment check-in is confirmed, puts a **filing task with a 24-hour SLA countdown** in the ops queue, and staff file via the official channel (online portal or app) and record the filing receipt back on the booking. The unhappy path (portal down, can't file) escalates per SLA config. No scraping/automation of the government portal in the first loop.
- **Needs from founder:** confirm manual-with-tracking is acceptable for loop one; whose Immigration Bureau registration (which legal entity / property registrations) staff file under.

### Q11. Guest identity verification — what exactly is required pre-arrival? — PROVISIONAL
- **Source:** doc 07 booking/pre-arrival; "verified guest" gate in v3 §11.
- **Provisional stance:** first loop = **passport capture pre-arrival** (required for TM30 anyway) + payment through the licensed provider as the financial verification; no third-party ID-verification vendor. The "verification failed" unhappy path = passport not provided by check-in ⇒ configurable action (block self-check-in, host contacts guest).
- **Needs from founder:** confirm; name a KYC vendor only if stronger verification is wanted for high-stakes rentals.

### Q12. The cancellation policy defaults — PROVISIONAL
- **Source:** doc 04 must ship a default cancellation policy; v3 says only that it is configuration.
- **Provisional stance (doc 04 §5):** three named policies mirroring market practice — `flexible` (full refund to 24h before check-in), `moderate` (full to 5 days, 50% after), `strict` (50% to 14 days, none after) — default `moderate`, overridable per project and per unit. Service orders: full refund up to `service.cancel_window_hours` (default 24h) before the slot, none after, provider no-show = full refund always.
- **Needs from founder:** confirm the three schedules and defaults (they are pure configuration and editable in the admin panel at any time).

### Q13. Seasons for pricing — the actual season calendar — PROVISIONAL
- **Source:** doc 04 rate bands (low/high/peak) need date ranges; v3 gives none.
- **Provisional stance:** shipped as fully editable **season calendar** config with Phuket-conventional defaults marked provisional: peak = 15 Dec–15 Jan; high = Nov–Apr (outside peak); low = May–Oct. Season markup percentages default: high +25%, peak +60% over base (`pricing.season.*`).
- **Needs from founder:** confirm dates and markups per project.

### Q14. Commission numbers — the actual defaults — PROVISIONAL
- **Source:** doc 04. v3 gives formulas (owner = MIN(NOI, cap); MC fee 10–15%; services take-rate) but not numbers.
- **Provisional stance (doc 04 §3, all editable):** `engagement.direct.noi_cap_annual_thb` — **no default; must be set per unit at mobilization** (it is a negotiated term). `engagement.via_mc.platform_fee_pct = 12` (middle of the stated 10–15). `engagement.owner_direct.booking_fee_pct = 10`. `services.take_rate_pct = 15`. Setup fee `engagement.direct.setup_fee_thb = 0` (off) by default.
- **Needs from founder:** real numbers for the first project's mandates.

### Q15. The Ombudsman credential — how is it shown? — OPEN
- **Source:** docs 08 (trust pages) and positioning. The credential is a real-world credential; the trust page needs its exact name, wording, and any logo/verification link that may legally be used.
- **Needs from founder:** the exact credential text/assets permitted for publication (content keys `trust.ombudsman.*` are reserved and empty).

### Q16. Legal entity names, licenses, and contact details for public pages — OPEN
- **Source:** doc 08 footer/trust/legal pages; doc 12 (controller identity under PDPA).
- **Needs from founder:** registered entity name(s) for myUNO/Ignatev Estate/Ignatev Capital, license references, registered address, support phone/WhatsApp, and the privacy-contact mailbox. Content keys reserved under `legal.*` and `trust.*`.

### Q17. Owner statement cadence and sign-off — PROVISIONAL
- **Source:** doc 07 F-FIN-1; v3 §13 says "periodic" and "sign-off gate" without cadence.
- **Provisional stance:** **monthly** statements, generated on the (configurable) 5th of the following month, founder/admin reviews and publishes; owner sees it in the portfolio and gets notified. `finance.statement.day_of_month=5`, `finance.statement.requires_admin_signoff=true`.
- **Needs from founder:** confirm monthly + the day; confirm payout timing relative to statement publication (default: payout marked after publication, recorded manually in loop one — see Q18).

### Q18. Owner payouts — rails in the first loop — PROVISIONAL
- **Source:** doc 10 §6. Paying owners (often abroad, RU-connected) is banking reality, not just software.
- **Provisional stance:** loop one records payouts (amount, date, reference, method) against statements — **execution is manual** via the company's bank; no automated payout rail. FX routing, where a party wants non-THB, is **information + routing to a licensed exchanger** only, per the constitution.
- **Needs from founder:** confirm manual payouts for loop one and the accepted payout methods list (THB bank transfer; other?).

### Q19. RU / EN / TH — which locale is the platform default, and who translates TH? — PROVISIONAL
- **Provisional stance (doc 05):** default locale **RU** (the clientele), user-switchable; EN complete at launch; TH keys exist from day one but may lag — fallback chain per key: requested → EN → RU → key name visibly marked. The founder edits all three in the admin content editor.
- **Needs from founder:** confirm RU default; who produces TH strings (staff, translator, or machine-translate-then-review workflow — the editor supports a "needs review" flag either way).

### Q20. Real content for the first project & services catalog — OPEN
- **Source:** docs 07/08/09 reference the project's amenities, rules, services and providers; the specs define the **structures and keys**, not the actual Thai-life content.
- **Needs from founder:** first project's handbook content, house rules, amenity list, the initial provider list (transfer, cleaning, chef, …) with commercial terms, and the project's photography.

---

*Maintained by Fable. New gaps found while walking journeys are appended; nothing is silently invented.*
