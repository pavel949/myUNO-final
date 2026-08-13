# CLAUDE.md — myUNO Platform (Ignatev Estate)

This file is read at the start of every session. It is the project's constitution. Follow it.

## What we are building

**myUNO** — the operating platform for serviced living in Phuket's Andaman corridor, for a Russian-speaking clientele. It runs a residence's whole life: **stay, live, own**. Model: `docs/business/Ignatev_Estate_Business_and_Operating_Model_v3.md`. Positioning: `docs/business/positioning.md`. Journey coverage: `docs/business/user_journey_audit.md`.

**Status: the specification suite (docs 00–16) is complete.** The build phase executes `docs/16_build_plan.md` one task at a time. Decisions D1–D10 are locked in `docs/01_architecture_decisions.md`; if any must move, that document changes first and the suite follows.

## The architecture spine — non-negotiable

**project → unit → identity → roles**, enforced **in the schema** (doc 02), not by convention:

- **Project** — a development where inventory is concentrated; first-class, with its own brand, community, services.
- **Unit** — a home inside a project; at any time belongs to one project and one owner. Its **engagement type** (direct-managed / via management company / owner-direct) selects its configurable economics.
- **Identity** — a person, global and singular.
- **Roles** — `RoleAssignment` rows scoped to projects and units; **roles are data, not code branches**. Permission checks go through `core.can()` against the doc 03 matrix.
- **Portfolio overlay** — an owner's aggregated view across all projects where they hold units.

The platform is the single **system of record** (map: doc 14 §4). OTAs, Telegram, WhatsApp, the CRM, and payment tools are all **channels** onto it. Enter a unit once; it appears everywhere; the transaction happens on our rails. If a requirement seems to need a different shape, **stop and ask**.

## The locked stack & shape (doc 01 D2, doc 14)

One **modular monolith**: Next.js (App Router) + TypeScript strict + PostgreSQL + Prisma (migration files, never db-push), Tailwind themed from the design tokens, Vitest three-tier tests. Modules live in `src/modules/*`, each exposing one `index.ts` interface. **Three rules:** (1) a module never owns the customer — only `core` writes identities/roles; (2) modules connect only through the core and the shared seams; (3) common → core, specific → module. No microservices; no plugin infrastructure before the first loop.

## Everything editable without code — three layers (built first, always used)

- **Content / i18n.** Every user-facing string is a **content key** (RU/EN/TH) in the database, edited in the admin panel, rendered via `t()`. Agents never write user-facing copy inline — missing strings become keys with `needs_review` drafts (doc 05 §1). The `no-literal-ui-text` lint enforces this.
- **Configuration / business rules.** Every commission, fee, rate, cap, markup, SLA — and the **cancellation policy** — is a registered parameter (doc 04) read via `config.get()`, overridable per project/unit, audit-logged. New rules must be added to doc 04 in the same commit.
- **Design.** All UI comes from the **design system** (doc 06): tokens, components with all states (empty/loading/error included), screen compositions. Agents never invent colours, type, or components.

**The rule that ties them together:** the look from the **design system**, the words from the **content layer**, the rules from **configuration**, the structure from the **specs**. Nothing is invented.

## Roles & permissions

Roles: owner, guest, resident, buyer, provider member, MC member, juristic member, staff (ops, on-site host), admin/founder — scoped to projects and units per the doc 03 matrix (its table-driven test must stay in lockstep). Announcements are posted by **myUNO or the juristic person / management company**. Any role may consume services. Nothing is visible or doable outside a role's scope; enforcement is server-side in every query.

## Communication & services — a shared layer across roles

Threads, tickets, announcements, and notifications are the **shared `comms` layer** (doc 09), never rebuilt inside a feature. Any owner or resident can raise a ticket and **see its status and history** — transparency for remote owners. The services marketplace serves **any role**; orders attach to the identity **and its role**. Booking is first-class for both stays and services, and so are **cancellation, refund, and modification** — with every unhappy path (payment fails, verification fails, TM30 can't file, provider no-show) specified in doc 07 and built.

## CRM & commercial system (docs 17–18)

**Native CRM** — no external system (HubSpot, Salesforce). All contacts, deals, and activities live in the platform as a first-class module (`src/modules/crm/`). **Identity is shared**: every CRM contact is an `identity`, and every identity can have a profile (lifecycle stage, lead score), opportunities (rental, purchase, sale, management, dev advisory, capex, compliance), activities (calls, emails, meetings, tasks, notes via WhatsApp/Telegram), and consent records (PDPA audit trail). Deals attach to projects/units or remain unbound. No silos — a guest becomes a prospect becomes a buyer on the same identity record. Admin pipeline UI (drag-to-transition) sits at `/app/admin/crm`. Lead ingestion from external sources via `POST /api/leads` (becomes a `crm_profile` + lead activity). Attribution tracking (source, medium, campaign) for marketing mix modeling.

**Lifecycle management** — See `docs/corporate_bible_integration.md` for phased roadmap. The CRM foundation (just shipped via CRM-1 patch) will be extended to track explicit customer lifecycle stages (Contact → Guest → Repeat → Investor → Buyer → Owner → Managed), account ownership, and transition audit logs. This is Phase 1 of a six-phase integration plan that aligns the platform with Ignatev Estate's business model and brand architecture.

## Money rules (doc 10)

Charging is **cash-first in loop one** — a recorded cash payment captures who took it, when, and the receipt/чек number (the primary rail for the RU clientele) — with the provider **payment seam** behind it (mock adapter; default provider **Opn/Omise**; cards and Thai methods switched on later — Q8). **Crypto is not accepted** (SEC/BOT-licensed activity — Q21). Amounts are **server-computed, client-sent totals never trusted**; THB only (satang integers); deposits are provider pre-authorizations only, **never held in cash**; the **ledger is append-only** and every statement number links to its source rows; statements gate on admin sign-off; a direct-managed unit without its NOI cap refuses statement generation — no guessing.

## Legal non-negotiables

- **Currency exchange:** never operate FX. Route to a licensed exchanger only. (AMLO.)
- **Guest funds / deposits:** never hold funds without a license. Deposits are provider pre-authorizations only (Q6). (Bank of Thailand.)
- **Immigration:** TM30 within 24 hours of every foreign guest's arrival — a first-class SLA object with escalation (doc 07 F-OPS-2). The 24h config ceiling may only be tightened.
- **Licensing:** permitted-use confirmation is a hard gate before any unit goes live.
- **Personal data:** passports, payment data, PII under PDPA per doc 12 — field-level encryption for 🔒 fields, access logging, retention jobs. Builders never log PII, never store card data, never put PII in analytics or URLs.
- **PII encryption key:** The `ENCRYPTION_KEY` (AES-256-GCM) must be rotated/secured **before** any production go-live, but **never changed** once it contains encrypted data. A changed key causes permanent decryption failure — all encrypted passports become unreadable. See docs/15_deployment.md §4.

## No invention — stop and ask

If a detail is missing — a text, a rule, a field, a flow step, a component — the agent **STOPS and ASKS**: log it in `docs/open_questions.md` and stop at that edge. Never guess. ⚠-marked provisional defaults in the specs trace to open questions Q1–Q20 and stand until the founder rules.

## Legacy policy

The founder's old repos (sibling folders, see `legacy/README.md`) are a **parts bin, not a foundation, and not the look**. Doc 00 holds the take/don't-take decisions: re-implement taken *patterns* idiomatically inside `src/modules/*`; never import legacy files, schemas, or visuals; never run legacy code as part of the new system.

## Working conventions (build phase)

- Execute `docs/16_build_plan.md` **one task per session, in order**. Read the task's named specs first.
- Every task ends with green tests + build + lints and **a commit naming the task id**. Tests named in a DoD are mandatory.
- New events → doc 13; new notifications → doc 11; new config → doc 04; new content namespaces → doc 05 — updated in the same commit, or the addition is invalid.
- Write and explain for a **non-technical founder** — plain language.
- Do not expand scope. First loop first (through T-032); smaller and correct beats broad and shaky.

## Where things are

- `docs/business/` — model, positioning, journey audit. `docs/brand/` — brand and art direction.
- The suite: `docs/00_legacy_audit` · `01_architecture_decisions` (locked D1–D10) · `02_data_model` · `03_roles_and_permissions` · `04_configuration` · `05_content_i18n` · `06_design_system` · `07_flows` · `08_pages` · `09_communication_and_services` · `10_payments` · `11_notifications` · `12_security_privacy` · `13_analytics` · `14_tech_spec` · `15_deployment` · `16_build_plan` · `17_crm_and_commercial_system` · `18_platform_architecture` · `corporate_bible_integration` (implementation roadmap, six phases) · `open_questions` (maintained — the founder's question queue).

## Business Model & Brand Architecture

myUNO operates within Ignatev Estate's owner-side model, which manages real estate economics from acquisition through operation to exit. **Three brand layers:**
- **Ignatev** — Owner-side representation, mandate decisions, founder judgment.
- **ClearView** — Underwriting, risk assessment, proof of asset quality.
- **myUNO** — Operational standard, systems, guest/resident experience, direct booking.

Each layer serves a distinct purpose and audience. See `docs/corporate_bible_integration.md` Phase 6 (documentation) for detailed brand positioning guidelines.

**Unified customer model:** One identity record spans multiple roles over time (guest → repeat → owner). Revenue comes from management fees, performance fees (exceeding baseline NOI), transaction fees (sale/purchase), and distribution partner commissions. All fees are transparent and audit-logged. Owner reporting is monthly with line-item traceability. See `docs/corporate_bible_integration.md` Phases 2–5 for implementation roadmap.

*Maintained by Core Platform Team. Keep this file current as the architecture solidifies.*
