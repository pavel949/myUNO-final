# CLAUDE.md — myUNO Platform (Ignatev Estate)

This file is read at the start of every session. It is the project's constitution. Follow it.

## What we are building

**myUNO** — the operating platform for serviced living in Phuket's Andaman corridor, for a Russian-speaking clientele. It runs a residence's whole life: **stay, live, own**. Model: `docs/business/Ignatev_Estate_Business_and_Operating_Model_v3.md`. Positioning: `docs/business/positioning.md`. Journey coverage: `docs/business/user_journey_audit.md`.

## The architecture spine — non-negotiable

**project → unit → identity → roles**

- **Project** — a development where inventory is concentrated; first-class, with its own brand, community, services.
- **Unit** — a home inside a project; at any time belongs to one project and one owner.
- **Identity** — a person, global and singular.
- **Roles** — scoped to projects and units; they decide what a person sees and can do.
- **Portfolio overlay** — an owner's aggregated view across all projects where they hold units.

The platform is the single **system of record**. OTAs, Telegram, WhatsApp, commodity CRM/booking tools are all **channels** to it. Enter a unit once; it appears everywhere; the transaction happens on our rails. If a requirement seems to need a different shape, **stop and ask**.

## Modular architecture — a modular monolith

- **Core** (never duplicated): identity / customer base, projects, units, bookings, payments, compliance.
- **Modules** attach to the core through a **defined interface**.
- **Three rules:** (1) a module never owns the customer — the customer lives in the core; (2) modules connect only through the core; (3) common → core, specific → module.

Build as a **modular monolith, not microservices.** Design boundaries now; don't build plugin infrastructure before the first loop.

## Everything editable without code — three layers

- **Content / i18n.** Every user-facing string is a **content key** with **RU / EN / TH**, editable via the admin panel. Agents never write user-facing copy inline.
- **Configuration / business rules.** Every commission, fee, rate, cap, markup, SLA — and the **cancellation policy** — lives in **editable configuration**, never hardcoded, overridable per project.
- **Design.** All UI is built from the **design system** (`docs/06_design_system.md`), which expands the brand. Agents never invent colours, type, or components.

**The rule that ties them together:** the look comes from the **design system**, the words from the **content layer**, the rules from **configuration**, the structure from the **specs**. Nothing is invented.

## Roles & permissions

Everyone is a role: owner, guest, buyer, provider, staff (operations, on-site host), management company / juristic person, admin/founder. Roles are scoped to projects and units. Announcements can be posted by the **juristic person / management company**, not only by myUNO. Nothing is visible or doable outside a role's scope.

## Communication & services — a shared layer across roles

- Messaging, tickets/complaints, and announcements are a **shared layer**, not locked to guest↔host. Any owner or resident can raise a ticket and **see its status** — transparency for remote owners.
- The concierge / partner services marketplace (repairs, cleaning, transfers, …) is available to **any role** — not only guests. Messages, tickets, announcements, and service orders **attach to the identity and its role**.
- **Booking is first-class for both stays and services**, and so are their **cancellation, refund, and modification** flows — not afterthoughts. Every flow covers its **unhappy paths** (payment fails, verification fails, TM30 can't file, provider no-show), not only the happy path.

## Unit engagement types

A unit relates to the platform in one of several ways, each with its own **configurable economics**: directly managed (NOI split with cap), listed via a management company (platform fee), owner-direct listing. Engagement type drives which commission config applies.

## Scope discipline — first loop first

Build the **reachable first loop only**: owners + guests + services + capturing the guest→buyer signal, in **one project**. The spine, roles, config, content, design, and communication foundations exist from day one. Breadth (multi-project at scale, whole-complex onboarding, management-company absorption, the full community marketplace, a full service-desk) comes later. Flag scope creep and stop.

## Legal non-negotiables

- **Currency exchange:** never operate FX. Route to a licensed exchanger only. (AMLO.)
- **Guest funds / deposits:** never hold funds without a license. Route through a licensed payment provider. (Bank of Thailand.)
- **Immigration:** file TM30 within 24 hours of every foreign guest's arrival.
- **Licensing:** confirm short-let / permitted-use legality per property before it goes live.
- **Personal data:** handle passports, payment data, PII under Thailand's PDPA (see the security spec).

## No invention — stop and ask

If a detail is missing — a text, a rule, a field, a flow step, a component — the agent **STOPS and ASKS**. It never invents.

## Legacy policy

`legacy/*` is a **parts bin, not a foundation, and not the look.** Reuse isolated components and logic. **Rebuild the data model** around the spine; the visual language is single and new. Never wire the new app to legacy architecture; never run legacy code as part of the new system.

## Fable owns integrity and finds the gaps

Fable is responsible that the whole system works end to end as **one coherent, functional product**. It **finds gaps**: it walks every role's journey in `docs/business/user_journey_audit.md` from start to finish (especially the remote owner) and maintains `docs/open_questions.md` — anything a scenario needs that the specs don't cover. It asks the founder rather than inventing.

## Working conventions

- Modular monolith, clear boundaries; one module at a time.
- **Stop and ask** at real forks.
- **Commit after each unit of work**, with a clear message.
- Write and explain for a **non-technical founder** — plain language.
- Do not expand scope on your own. Smaller and correct beats broad and shaky.

## Where things are

- `docs/business/` — model, positioning, journey audit. `docs/brand/` — brand and art direction.
- `docs/00_legacy_audit` · `01_architecture_decisions` · `02_data_model` · `03_roles_and_permissions` · `04_configuration` · `05_content_i18n` · `06_design_system` · `07_flows` · `08_pages` · `09_communication_and_services` · `10_payments` · `11_notifications` · `12_security_privacy` · `13_analytics` · `14_tech_spec` · `15_deployment` · `16_build_plan` · `open_questions` (maintained)

*Maintained by Fable. Keep this file current as the architecture solidifies.*
