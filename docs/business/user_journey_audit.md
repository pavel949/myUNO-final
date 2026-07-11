# User Journey & Flow Audit

A coverage check before build. Every role's journey, end to end, and every booking / payment / communication flow — mapped to the spec that covers it. **Fable must verify its flows (`docs/07_flows.md`) cover everything here; any step not covered goes to `docs/open_questions.md`.**

---

## 1. Journeys by role (end to end)

**Guest.** discover (by project or unit; via OTA, direct, or the home space) → inquire & quote → book → pay → pre-arrival (passport, upsells) → check-in + TM30 → in-stay (concierge, book services, message host, raise issue) → extend → check-out → review → re-engage → *(may surface as buyer)*. — Covered: 07, 08, 09, 10, 11, 12, 13.

**Owner (directly managed).** discover → entrust unit → mobilization (audit, standards, pricing, go-live) → unit occupied & earning → receive statements & payouts → raise tickets to ops → **book services for their own unit** (repair, cleaning) → *(when in residence, becomes a resident-guest)* → decide to sell → sell via Capital → onboard new/other asset. — Covered: 07, 04 (split/cap), 09 (tickets + services), 10 (payouts), 11.
- **Remote owner:** the same, transparency-first — dashboard, ticket *status*, statements, without phone calls. — Covered: 09 (ticket status), 08 (dashboard), 11.
- **Multi-project owner:** portfolio view + project switcher across projects. — Covered: 03, 06, 08.

**Buyer.** signal detected → nurture → browse vetted units → request due diligence → transaction support (Capital) → close → new asset onboarded → re-listed. — Covered: 13 (signal), model Process H. *Mostly Capital-led / phase-2 — see deferred.*

**Provider (services supply).** apply → get vetted (badge) → receive service orders → accept → fulfil → get paid → rated. — Covered: 07 (onboarding), 09 (service orders), 10 (provider payment).

**Management company / juristic person.** onboard → list their units (engagement type = via-MC) → post announcements → receive residents' tickets → operate → **book services** (e.g. common-area cleaning) → myUNO takes the platform fee (10–15%) → reporting. — Covered: 03 (role, announcements), 09 (listing, tickets, services), 04/10 (platform fee).

**Resident (long-term / owner-occupier).** access the project home space → community → book services → raise tickets → receive announcements. — Covered: 09, 08.

**Staff / operations / on-site host.** onboard → assigned to projects → handle ops (housekeeping, maintenance, contractors) → handle guest issues → file TM30 → receive assigned tickets, meet SLAs. — Covered: 03, 07 (ops flows), 09 (tickets), 12 (TM30).

**Developer (complex).** view the developer page → the class-uplift case → engage. — Covered: 08 (developer page), model Process G. *Whole-complex onboarding = phase-2 — see deferred.*

**Admin / founder.** edit configuration (commissions, fees) → edit content (RU/EN/TH) → manage roles → oversee. — Covered: 04, 05, 08 (admin panel).

---

## 2. Booking flows specifically

- **Accommodation booking (stay)** — the core. Covered: 07. ✓
- **Service booking / order** — select service → schedule → pay → provider confirms → fulfil → rate. **Available to ANY role** (owner, management company, resident, guest), not only guests. — *Was implicit; now explicit in 07 and 09.*
- **Rental listing → booking** (via the home space / community) — Covered: 09 + 07.

---

## 3. Gaps found and closed (added to the package)

- **Service booking flow** — now an explicit flow in 07, for any role, mirrored in 09. *(This was the main hole: services were listed as available but the order flow wasn't specified.)*
- **Cancellation / refund / modification** — now explicit flows in 07, for both stays and services. The **cancellation policy is configuration** (04); **refunds respect the no-holding-funds rule** and route through the licensed provider (10).
- **Basic search & discovery** — now explicit in 07 (first-loop level: find by project or unit, with availability).
- **Unhappy paths** — 07 must cover the failure branch of every flow (payment fails, guest fails verification, TM30 can't file, provider no-show), not only the happy path.

## 4. Flagged as open questions (for the founder / Fable to resolve)

- **Deposit & refund mechanics under “no funds held.”** If we never hold funds, how are security deposits taken and refunds issued through the licensed provider? A real design decision — seeded in `open_questions.md`.
- **Owner staying in their own unit (resident-guest).** Do they book it (blocked to guests for those dates), use it free, and how does it show in occupancy and the owner statement? Seeded in `open_questions.md`.

---

## 5. Intentionally deferred (not gaps)

These are **out of the first loop by design** — do not treat as missing:

- Whole-complex onboarding / change of class (Process G) — phase 2.
- Management-company *absorption* — phase 3 (listing them is in; absorbing them is later).
- Full sale / transaction flow — Capital-led and largely off-platform; the platform captures the guest→buyer signal (13) and the close-the-loop re-listing.
- Full service-desk (escalations, metrics) — later; a light ticket tracker is in the first loop.
- Full community marketplace (secondhand, events at scale) — later.

---

## 6. How completeness stays true

This audit is the **checklist**. `open_questions.md` is the **running register**. Fable walks every journey above end to end; anything a step needs that the specs don't cover is logged and asked, never invented.
