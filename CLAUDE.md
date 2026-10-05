# CLAUDE.md — myUNO Platform (Ignatev Estate)

Loaded into every Claude Code session. Keep it short; detail lives in the docs it points to.

## Session start — every task

1. Confirm targets: repo `pavel949/myUNO-final`, Vercel `my-uno-final`, Supabase **`burcnghheyzbzffzgmjz` only** (the `supabase-myuno` MCP in `.mcp.json` is pinned to it; `.claude/hooks/guard.mjs` denies any other ref).
2. Always read: `PROJECT.md` and `docs/canonical/AI_AGENT_RULES.md`. They are the binding rules (founder ruling 2026-09-29: `docs/canonical/` + `PROJECT.md` is the target architecture).
3. Then read only what the task touches:

| Task touches | Read |
|---|---|
| Schema, migrations, data | `docs/canonical/DATA_MODEL.md`, `MIGRATION_DELIVERY.md`, `docs/02_data_model.md` |
| Architecture, modules, integrations | `docs/canonical/ARCHITECTURE.md` |
| UI, pages, design | `docs/canonical/DESIGN.md`, `docs/06_design_system.md`, `docs/08_pages.md` |
| Roles, permissions, workspaces | `docs/canonical/ROLE_WORKSPACES.md`, `docs/03_roles_and_permissions.md` |
| Services marketplace | `docs/canonical/SERVICES_MARKETPLACE.md`, `docs/09_communication_and_services.md` |
| CRM, lifecycle, owners, fees, copy tone | `docs/canonical/CRM_SPEC.md`, `docs/business/brand_and_governance.md` |
| Money | `docs/10_payments.md` + Money rules below |
| Choosing what to build next | `docs/canonical/ROADMAP.md`, `RECONCILIATION.md`, `DECISIONS_CHANGELOG.md` |
| Declaring done | `docs/canonical/QA_ACCEPTANCE.md`, `READINESS_ACCEPTANCE.md`, then run `/ship-check` |

4. Migrations: Prisma files in `prisma/migrations` are the only ledger. Never apply schema through Supabase MCP `apply_migration` or the Supabase CLI. Run the `migration-reviewer` subagent on every new migration before asking Pavel to approve.
5. Finish every task with `/ship-check`. Done = merged + deployed + reachable by an anonymous user + names the loop metric it moves.

## What we are building

**myUNO** — a unified property, stay, ownership, relationship and Phuket services network (see `PROJECT.md` §1 for the full mission and north star). It grew from a narrower first loop — serviced living in Phuket's Andaman corridor for a Russian-speaking clientele, running a residence's whole life: **stay, live, own** — and that loop's model/positioning/journey docs remain accurate reading: `docs/business/Ignatev_Estate_Business_and_Operating_Model_v3.md`, `docs/business/positioning.md`, `docs/business/user_journey_audit.md`.

**Status:** the original specification suite (docs 00–16) and its build plan (through T-043) are **complete and shipped** — that is the "current behavior" the canonical pack's `RECONCILIATION.md` reconciles against. Forward work now follows `docs/canonical/ROADMAP.md`'s phases, not `docs/16_build_plan.md`'s task list. Decisions D1–D10 in `docs/01_architecture_decisions.md` still describe real, locked choices for the shipped system; a decision that the canonical pack revises is superseded there, not silently overridden here.

## The architecture spine — current shipped shape

**project → unit → identity → roles**, enforced **in the schema** (doc 02), not by convention:

- **Project** — a development where inventory is concentrated; first-class, with its own brand, community, services.
- **Unit** — a home inside a project; at any time belongs to one project and one owner. Its **engagement type** (direct-managed / via management company / owner-direct) selects its configurable economics.
- **Identity** — a person, global and singular.
- **Roles** — `RoleAssignment` rows scoped to projects and units; **roles are data, not code branches**. Permission checks go through `core.can()` against the doc 03 matrix.
- **Portfolio overlay** — an owner's aggregated view across all projects where they hold units.

**Target state (`docs/canonical/ARCHITECTURE.md` §7):** the scope chain extends this to `platform → organization → property/project → collection → unit`, with identity and authority modeled separately (organization membership + scoped role assignment + operating authority, not role-implies-authority). This is a superset of the spine above, not a contradiction of it — a `collection` sits between project and unit for multi-building/phased developments, and `organization` generalizes what "management company" already meant. Building that extension is tracked in `docs/canonical/ROADMAP.md` Phase 2 (OperatingScope authority, organization membership).

The platform is the single **system of record**. OTAs, Telegram, WhatsApp, the CRM, and payment tools are all **channels** onto it (canonical: `ExternalSystem`/`ExternalRecordLink`/`BusinessEvent` contracts, doc `docs/canonical/ARCHITECTURE.md` §4 — never mirror a table, never treat a projection as command authority). Enter a unit once; it appears everywhere; the transaction happens on our rails. If a requirement seems to need a different shape, **stop and ask** per `docs/canonical/AI_AGENT_RULES.md` §14 (genuine commercial/legal/irreversible calls only — routine structure is yours to decide and build).

## The stack & module shape (doc 01 D2, doc 14; target state doc 01 above)

One **modular monolith** — the canonical pack agrees explicitly (`ARCHITECTURE.md` §1: "do not split into microservices for aesthetics"): Next.js (App Router) + TypeScript strict + PostgreSQL + Prisma (migration files, never db-push), Tailwind themed from the design tokens, Vitest three-tier tests. Modules live in `src/modules/*` (17 today: `analytics, audit, auth, booking, browse, comms, compliance, config, content, core, crm, finance, integrations, media, ops, projects, services` — more than doc 14's original 10; the tech spec's module list is stale and due an update, not a source of truth for what exists), each exposing one `index.ts` interface. **Three rules:** (1) a module never owns the customer — only `core` writes identities/roles; (2) modules connect only through another module's `index.ts` and the shared seams in `lib/` — never reach into a module's internal files, and never export a function from an internal file that a caller outside the module already needs without also exporting it from `index.ts`; (3) common → core, specific → module. No plugin infrastructure. Splitting a service out of the monolith needs a measured bottleneck and a stable domain boundary first (`ARCHITECTURE.md` §10), never done for its own sake.

**The one deliberate exception to rule (2):** a `'use client'` component may import a module's internal file directly instead of its barrel `index.ts` when the barrel would drag server-only code (`node:crypto`, `next/headers`, anything Node-only) into the client bundle through some unrelated export the same barrel carries — Next.js's build fails outright if this happens, so it is never silent. This bit twice in the 2026-09-29 boundary-violation cleanup: `CheckInConditionReportModal.tsx`/`CheckOutConditionReportModal.tsx` importing `@/modules/ops` transitively reached `next/headers` via `ops-board.service → booking's index → home-space.service → lib/i18n.ts`; the admin payout routes importing `@/modules/finance` would have made an *already-working, unrelated* client component (`owner/statements/[statementId]/client.tsx`, importing `SIGNABLE_STATEMENT_STATUSES` from the same barrel) newly fail to build, because `payout-ledger.service`'s `node:crypto` import joined that barrel. Before "fixing" a module-boundary bypass by pointing it at the barrel, run `npm run build` — if it breaks, the bypass was load-bearing, not sloppy; keep it, and leave a comment saying why (see the two files above for the pattern). Never solve this by widening what a barrel exports without checking every existing client-side importer of that same barrel first.

## Everything editable without code — three layers (built first, always used)

- **Content / i18n.** Every user-facing string is a **content key** (RU/EN/TH, plus ZH drafts on public guest-facing namespaces — doc 05) in the database, edited in the admin panel, rendered via `t()`. Agents never write user-facing copy inline — missing strings become keys with `needs_review` drafts (doc 05 §1). The `no-literal-ui-text` lint enforces this.
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

## No invention — stop and ask (refined by `docs/canonical/AI_AGENT_RULES.md` §3, §14)

Never invent management authority, ownership, inventory, rates/taxes/fees, provider verification, supply availability, legal claims, performance stats, 24/7 promises, partner counts, or ROI. Missing truth becomes a draft/disabled state, an `unknown`, a validation blocker, or a config requirement — not a guess.

That said, **stop-and-ask is narrower than the original wording above implied.** Ask the founder only for genuine commercial, legal, or irreversible decisions. Do **not** ask for table names, code patterns, routine bug fixes, or permission to preserve canonical integrity — those are yours to decide and build. For a commercial uncertainty (a rate, a threshold, a policy): gather evidence, present concrete options, implement the reversible structure, and keep the unapproved capability disabled — don't stall the whole feature on one unresolved number. When you do stop, log it in `docs/open_questions.md`. ⚠-marked provisional defaults in the doc 00–18 suite trace to open questions there and stand until the founder rules; canonical-pack findings needing evidence are tracked in `docs/canonical/DECISIONS_CHANGELOG.md`'s "Commercial decisions requiring real evidence" list.

## Legacy policy

The founder's old repos (sibling folders, see `legacy/README.md`) are a **parts bin, not a foundation, and not the look**. Doc 00 holds the take/don't-take decisions: re-implement taken *patterns* idiomatically inside `src/modules/*`; never import legacy files, schemas, or visuals; never run legacy code as part of the new system.

## Working conventions

Follow `docs/canonical/AI_AGENT_RULES.md`'s mandatory workflow: **inspect** current HEAD/open PRs/schema/tests before changing anything → **reconcile** (state `preserve / extend / fix / migrate / already fixed / not checked` against `docs/canonical/RECONCILIATION.md`) → **implement the full vertical slice** (`input → authority → state → money → communication → failure → evidence → handover → UI` — a route or a table alone is not a feature) → **migrate safely** (expand → backfill → parity → cutover → observe → contract later; never mutate migration history from build/install) → **test** → **verify at runtime where credentials allow, else mark `not checked`** → **update docs/evidence**.

- Work through `docs/canonical/ROADMAP.md`'s phases (currently Phase 0–8); a task from the old `docs/16_build_plan.md` that's still unbuilt is folded into whichever phase it now belongs to, not executed against a stale T-number.
- Every change ends with green tests + build + lints. State the requirement/process ID it addresses (a doc-16 T-number for legacy-suite work, a `docs/canonical/ROADMAP.md` phase item, or an F-number/finding ID otherwise) in the commit — never an untraceable change.
- New events → doc 13; new notifications → doc 11; new config → doc 04; new content namespaces → doc 05 — updated in the same commit, or the addition is invalid.
- Don't declare something done from a green build alone (`AI_AGENT_RULES.md` §13) — completion evidence is code + schema + data/config + auth + UX + tests + deploy + runtime verification, as applicable; say plainly which of those you could and couldn't check.
- Write and explain for a **non-technical founder** — plain language.
- Smaller and correct beats broad and shaky — a phase's exit criteria (`ROADMAP.md`) is the unit of "done," not a whole phase rushed at once.

## Where things are

- **`PROJECT.md`** and **`docs/canonical/`** — the target architecture (read order above). Start here.
- `docs/business/` — model, positioning, journey audit. `docs/brand/` — brand and art direction.
- `docs/architecture/` — deep-dive specs for pieces of the canonical build already underway (e.g. `CANONICAL_PROPERTY_DATA_ARCHITECTURE.md`, `CANONICAL_STAY_DOMAIN_CONTRACT.md`, `ERD_CORE_DOMAIN.md`) — read alongside `docs/canonical/ARCHITECTURE.md` and `DATA_MODEL.md`, not instead of them.
- The original suite (current shipped behavior, doc 16's build plan complete through T-043): `docs/00_legacy_audit` · `01_architecture_decisions` (locked D1–D10) · `02_data_model` · `03_roles_and_permissions` · `04_configuration` · `05_content_i18n` · `06_design_system` · `07_flows` · `08_pages` · `09_communication_and_services` · `10_payments` · `11_notifications` · `12_security_privacy` · `13_analytics` · `14_tech_spec` (module list is stale — see the stack section above) · `15_deployment` · `16_build_plan` (complete; superseded going forward by `docs/canonical/ROADMAP.md`) · `17_crm_and_commercial_system` · `18_platform_architecture` · `corporate_bible_integration` · `open_questions` (maintained — the founder's question queue; keep it current, closed items must actually get closed, not just superseded silently).
- `docs/business/brand_and_governance.md` — brand layers (Ignatev / ClearView / myUNO / asset), customer lifecycle stages, data-governance access matrix, PII handling, fee transparency, tone by layer. Moved out of this file 2026-10-05; still binding.
