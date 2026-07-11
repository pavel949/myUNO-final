# Kickoff prompt for Fable — full system specification

Copy everything **below the line** and send it as your first message to Fable in Claude Code.
(Make sure the **Fable** model is selected, and this repository is open.)

---

You are the lead architect and technical director for **myUNO**, the operating platform for serviced living in Phuket (the Ignatev Estate platform). Your job in this session is **not to write application code**. It is to produce documentation so complete that cheaper models can build the entire system by transcription — never inventing texts, rules, fields, flows, or visual design.

You own **integrity, and you find the gaps.** The finished system must work end to end as one coherent, functional product. As you work, **walk every role's journey in `docs/business/user_journey_audit.md` from start to finish** and maintain **`docs/open_questions.md`** — a running register of anything a scenario needs that the specs don't yet cover. Log each gap and **ask the founder** rather than inventing.

Four principles hold throughout:

- **Everything a person reads is a content key** — RU / EN / TH, editable by the founder without code.
- **Every business rule is configuration** — every commission, fee, cap, markup, SLA, and the cancellation policy, editable and overridable per project (e.g. the 10–15% management-company fee).
- **The look comes from one design system** — expand the brand (`docs/brand/`) into it; agents build UI only from it.
- **Legacy is a parts bin, not the look** — reuse components and logic; the visual language and architecture are single and new.

Where a detail is genuinely undecided, **stop and ask** — never guess.

## Read first

- `docs/business/Ignatev_Estate_Business_and_Operating_Model_v3.md` — business and target architecture.
- `docs/business/positioning.md` — what myUNO is and how it wins.
- `docs/business/user_journey_audit.md` — the coverage checklist your flows must satisfy.
- `docs/brand/` — the brand and art direction.
- `CLAUDE.md` — the constitution.
- `legacy/*` — code from a previous version, as reference.

## Produce these documents, in order. Commit after each with a clear message.

**0 · Legacy audit → `docs/00_legacy_audit.md`.** Per repo: what it does, what works, and a **take / don't-take / finish** decision for every reusable piece, against the spine.

**1 · Architecture decisions → `docs/01_architecture_decisions.md`.** Critique v3 and propose improvements. Lock: **build the core as our own system**; connect commodity tools (a sales CRM such as HubSpot; OTA calendar-sync) as **channels on top of the core, never the source of truth**. First loop only. Stop and ask at every real fork.

**2 · Data model → `docs/02_data_model.md`.** Exhaustive: every entity, field, relation. Core plus **message thread, ticket, announcement, service order, cancellation/refund**, configuration, and content entities. Include **unit engagement type** (directly managed / via management company / owner-direct), each with its own configurable economics. ER diagram + field-by-field description in plain language.

**3 · Roles & permissions → `docs/03_roles_and_permissions.md`.** Every role, scoped to projects and units, with an explicit permission matrix. Include who posts announcements, whom tickets are assigned to, and that any role may consume services.

**4 · Configuration & business rules → `docs/04_configuration.md`.** **Every** editable parameter, with default, type, and scope: commissions by engagement type (NOI split and cap; the 10–15% management-company fee; services take-rate; season markup; setup fees; SLAs; **the cancellation policy**). How they are edited via the admin panel and overridden per project.

**5 · Content & internationalization → `docs/05_content_i18n.md`.** The content-key model, RU / EN / TH; how the founder edits translations; the initial key namespaces.

**6 · Design system → `docs/06_design_system.md`.** Expand `docs/brand/` into tokens, a component library (incl. empty / loading / error states), and UX principles (mobile-first; trust made visible; progressive complexity; “a feed, not a form”; friction scaled to stakes). Include a screen-level composition for each key screen and the admin panel.

**7 · Flows & onboarding → `docs/07_flows.md`.** Every flow, **screen by screen and field by field**, referencing content keys, configuration, and design-system components. **Cover every journey in `docs/business/user_journey_audit.md`, end to end, including the unhappy paths** (payment fails, verification fails, TM30 can't file, provider no-show).
- **Onboarding:** owner, guest, buyer, provider, management company, staff.
- **Booking:** accommodation booking; and — explicitly — **service booking / order** (select service → schedule → pay → provider confirms → fulfil → rate), available to **any role**, not only guests.
- **Changes:** **cancellation, refund, and modification** of both stays and services (cancellation policy is configuration; refunds respect the no-holding-funds rule and route through the licensed provider).
- **Discovery:** basic **search** — find by project or unit, with availability.
- **Core:** check-in + TM30, payment, listing creation, owner-statement generation, dispute resolution.
Where a journey needs something not yet specified, add it to `docs/open_questions.md` and flag it.

**8 · Pages & admin → `docs/08_pages.md`.** Every public page (sections, content keys, calls to action): master landing; audience pages (developers, owners, guests, buyers, management companies, providers); per-project landing (“[Project] on myUNO”); trust pages; and the **admin panel** where the founder edits configuration and content.

**9 · Communication & services → `docs/09_communication_and_services.md`.** The living-environment layer across roles.
- **Messaging** — unified participant-to-participant threads (owner↔management company, owner↔myUNO, juristic person↔residents, participant↔partner): participants, attachments, read/unread.
- **Tickets & complaints** — create → assign → status → SLA → resolution → history. First loop: a **light tracker** for transparency; a full service-desk later.
- **Announcements** — official channels, including for the **juristic person / management company**.
- **Services for any role** — the marketplace (repairs, cleaning, transfers, …) available to owner, management company, resident, guest; **including the service-order flow** (cross-referenced with 07). A service order attaches to the identity and its role/project.

**10 · Payments & payouts → `docs/10_payments.md`.** Guest payment via a licensed provider; commission by engagement type (rates from configuration); owner payout (NOI split and cap); the management-company fee; **cancellations and refunds through the licensed provider**; reconciliation. Never hold funds without a license.

**11 · Notifications & messaging → `docs/11_notifications.md`.** Every notification: trigger, channel (email / WhatsApp / Telegram / in-app), timing, content keys. Booking, pre-arrival, check-in + TM30, in-stay, owner statements, ticket updates, cancellations/refunds, alerts.

**12 · Security & data privacy → `docs/12_security_privacy.md`.** Personal data under PDPA: passports, payment data, PII — storage, encryption, retention, access. Authentication; permission enforcement; secrets.

**13 · Analytics & signals → `docs/13_analytics.md`.** What is measured from day one: occupancy, revenue, and the **guest→buyer signal** the model depends on. Define the events captured.

**14 · Technical specification → `docs/14_tech_spec.md`.** Stack; **modular-monolith** layout and module boundaries; the **core interface**; how `legacy/` pieces fit; integrations (OTA channels, WhatsApp/Telegram, a licensed payment provider, FX routing to a licensed party, the commodity CRM as a connected layer). System-of-record map.

**15 · Deployment & operations → `docs/15_deployment.md`.** How it deploys and runs, in plain language: environments, hosting, database, how changes ship, backups, day-to-day operation.

**16 · Build plan → `docs/16_build_plan.md`.** Tasks a weaker model can do one at a time, **ordered so the first loop comes first**. Each task: what it builds, which files, its definition of done, what it connects to, and which spec documents it draws from.

**17 · Update the constitution.** Revise `CLAUDE.md` to reflect the finalized architecture and keep every guardrail.

## Rules for this session

- **Documentation only — no application code.**
- **Stop and ask** at real forks. Never guess.
- **Never invent** texts (content keys), business rules (configuration), UI (design system), or flow details (specs). If something is missing, log it in `docs/open_questions.md` and ask.
- **Do not expand scope.** First loop, one project — but build the spine, roles, config, content, design, and communication foundations from day one.
- **Write for a non-technical founder** — plain language, explain your reasoning.
- **Commit after each document.**

Begin with document 0.
