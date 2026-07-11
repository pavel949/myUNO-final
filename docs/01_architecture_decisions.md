# 01 · Architecture Decisions

**What this document is.** The locked technical and structural decisions the whole specification suite rests on, each with its reasoning in plain language — plus an honest critique of the v3 model where it under-specifies the build. Where a decision was a *real fork* whose answer belongs to the founder, it is logged in `docs/open_questions.md` and the spec proceeds on a clearly-marked provisional stance.

---

## 1. Critique of v3 — what the model gets right, and where it under-specifies

The v3 model is unusually strong as a *business* document: the loop, the spine, the channel principle, and the sequencing discipline are exactly the right constraints for software. Five places needed sharpening before specification, and this suite sharpens them:

1. **"Platform" vs "product" was under-drawn.** v3 describes six jobs (§19) but not which are *software in loop one* versus *checklist-plus-human*. Decision D9 below draws that line explicitly, following v3's own warning (§36) against building software for all thirty processes at once.
2. **The economics were formulas without homes.** `MIN(NOI, cap)` needs a ledger to compute NOI from; v3 never says where costs are recorded. Doc 02 gives money a first-class ledger; doc 10 defines the statement pipeline. The actual numbers are configuration with founder-confirmed defaults (open questions Q14, Q17).
3. **The deposit contradiction.** v3 requires deposit reconciliation at check-out (§11) *and* forbids holding funds (§18/§35). These are reconcilable only through the payment provider's own instruments — resolved provisionally as pre-authorization via the licensed provider (open question Q6).
4. **The resident-guest was named but not specified.** The owner staying in their own unit affects occupancy math, statements, and cleaning costs. Specified provisionally as the zero-rent "owner stay" booking type (open question Q7).
5. **"Verified guest" had no definition.** The book gate says "cleared funds plus verified guest"; verification is now defined for loop one as passport capture + provider payment (open question Q11).

None of these change the model; they are the gaps a build hits on day three if unstated.

## 2. D1 — The core is our own system. Locked.

The system of record — projects, units, identities, roles, bookings, orders, money, compliance, content, configuration — is **built by us and owned by us**. Commodity tools connect *on top* as channels, never as the source of truth:

- **A sales CRM (e.g. HubSpot)** may receive owner/buyer leads and nurture sequences — but the identity graph lives in our core; the CRM gets a copy, never the pen.
- **OTA calendar-sync** (Airbnb/Booking via iCal first, channel manager later) publishes *our* availability and imports *their* bookings into *our* booking table. The calendar of record is ours.
- **Telegram/WhatsApp** are notification and publishing channels onto our record.

**Why locked:** the whole moat (continuity, the operating dataset, the arbiter role) exists only if one system holds the truth. Renting the core would rent the moat. This also settles v3 §20 concretely: the "CRM," "channel system," "ledger," and "compliance system" are **modules of one application**, not products we buy.

## 3. D2 — Modular monolith on a proven stack: Next.js + TypeScript + PostgreSQL + Prisma

One deployable application, one PostgreSQL database, with **hard internal module boundaries** (the module map is doc 14):

- **Framework:** Next.js (App Router) + TypeScript strict. UI and API in one codebase.
- **Database:** PostgreSQL. **ORM:** Prisma.
- **Auth:** NextAuth-pattern sessions with credentials + optional OAuth, extended with phone identifiers.
- **Styling:** Tailwind CSS bound to the design-system tokens (doc 06).

**Why.** (a) The legacy audit shows this exact stack carried a complete booking product with three tiers of tests — *in this team's hands*. (b) The build plan (doc 16) will be executed by cheaper models; they are strongest on this mainstream stack, and the Airbnb clone gives them working reference implementations for a third of the tasks. (c) A modular monolith is the constitution's requirement; Next.js route-handlers + a `src/modules/*` layout satisfy it without microservice overhead. **Rejected alternatives:** Keystone/condo's runtime (heavyweight, couples us to a framework we don't control — audit §2); a separate SPA + API backend (two deployables, no benefit at this scale); Supabase-as-backend (we own the DB and the auth rules; RLS-in-SaaS hides the permission model the specs must own).

## 4. D3 — The spine is enforced in the schema, not by convention

`Project`, `Unit`, `Identity`, and `RoleAssignment` are physical tables and every domain row hangs off them by foreign key (doc 02). A booking cannot exist without a unit; a unit cannot exist without a project; nothing user-visible exists without an identity and a role scope. The permission layer (doc 03) reads `RoleAssignment` rows — **roles are data, not code branches**, following condo's proven checkbox-permission pattern. This is what makes multi-project, portfolio overlay, and the project switcher structural rather than features.

## 5. D4 — The three editable layers are infrastructure, built first

- **Content:** every user-facing string is a `ContentKey` + per-locale `Translation` (RU/EN/TH) in the database, edited in the admin panel, served through one lookup component/helper. No inline copy, ever (doc 05).
- **Configuration:** every business rule is a typed `ConfigParameter` with a global default and **scoped overrides** (project, then unit/engagement where applicable), edited in the admin panel, read through one `getConfig(key, scope)` resolver, changes audit-logged (doc 04).
- **Design:** one token set + component library expanded from the brand (doc 06); Tailwind is configured from the tokens so agents physically cannot invent colors.

**Why first:** every subsequent build task consumes these three. Retrofitting editability is the single most expensive mistake available to us.

## 6. D5 — Booking is one engine with two products: stays and service orders

Stays (nights in a unit) and service orders (a slot with a provider) share the lifecycle machinery — request → confirm → pay → fulfil → review, with cancellation/refund/modification as first-class transitions — but are **separate tables** with their own fields and state charts (doc 02 §§8–9), because their realities differ (nights vs slots, TM30 vs no TM30, NOI vs take-rate). What they *share* is enforced shape: server-computed pricing, payment through the seam, policy-driven refunds, and unhappy-path states. Any role can place a service order; a stay's booker is a guest by definition (an owner booking their own unit gets the `owner_stay` type — Q7).

## 7. D6 — Payments: provider-agnostic seam, licensed provider, mock mode until chosen

All money movement goes through **one payment seam** (create checkout → provider webhook/return → idempotent confirm → refund via provider), implemented first with the built-in **mock provider** (proven pattern from the legacy clone) so every flow is buildable and testable end-to-end before the commercial choice of licensed Thai provider lands (Q8). myUNO **never holds funds**: charges settle with the provider/merchant of record; deposits are provider pre-authorizations (Q6); FX is routing-only; owner payouts in loop one are recorded, manually executed bank transfers (Q18). The full money map is doc 10.

## 8. D7 — Communication is one shared layer on the spine

Threads, tickets, announcements, and notifications are **core-adjacent shared services** (doc 09): any participant pair can hold a thread; any role can raise a ticket scoped to a unit or project; announcements are posted by myUNO **or the juristic person/management company** into a project; notifications fan out through one channel seam (in-app + email delivered in loop one; WhatsApp/Telegram specified but toggled off until provisioned — Q9). Nothing communication-shaped is ever built inside a single feature again (the legacy clone's guest↔host-only messaging is the anti-pattern).

## 9. D8 — OTA and messenger integration starts thin, by design

Loop one ships: **iCal two-way calendar sync** per unit (export our calendar; import OTA blocks as external bookings), manual listing parity, and OTA-guest capture at check-in (every OTA guest becomes an identity with a stay — v3 §26's "the OTA acquired them; we own the relationship"). A full channel manager API integration is phase 2 — the seam (doc 14 §6) is shaped for it now. Similarly Telegram/WhatsApp *publishing* of listings into groups (v3 §30.2) is phase 2; loop one wins the transaction, not the group.

## 10. D9 — Software vs checklist-plus-human in loop one

Following v3 §36, loop one **instruments** the high-leverage points and keeps the rest human-with-checklist *inside the platform's record*:

| Software in loop one | Human-with-record in loop one |
|---|---|
| Booking engine, availability, pricing, payments, refunds | Mobilization steps 1–6 (qualify → staging) tracked as a **checklist on the unit**, not workflow software |
| Guest verification capture, TM30 task with SLA countdown & receipt record | The actual TM30 filing at the portal (Q10) |
| Owner statements computed from the ledger | Payout execution at the bank (Q18) |
| Tickets (light tracker), threads, announcements, notifications | Full service-desk SLAs/escalation matrices (phase 2) |
| Service orders + provider confirmation | Provider vetting itself (badge recorded; diligence is human) |
| Analytics events, guest→buyer signal surfacing | Buyer nurture and the Capital transaction (off-platform, Q1) |

## 11. D10 — Non-negotiables carried into every spec

TM30 24-hour rule as a first-class SLA object; per-unit permitted-use confirmation gate before go-live; no FX operation; no fund-holding; PDPA handling of passports/PII with field-level encryption and retention rules (doc 12); THB as the single money currency in loop one.

## 12. Decision register

| # | Decision | Status |
|---|---|---|
| D1 | Own core; commodity tools as channels only | **Locked** (kickoff) |
| D2 | Modular monolith: Next.js + TS + PostgreSQL + Prisma | **Locked** |
| D3 | Spine enforced by schema; roles as data | **Locked** |
| D4 | Content/config/design layers built first | **Locked** |
| D5 | One booking engine, two products (stay, service order) | **Locked** |
| D6 | Payment seam + mock; licensed provider pluggable | **Locked**; provider = Q8; deposits = Q6 |
| D7 | One shared communication layer | **Locked** |
| D8 | Thin OTA (iCal) + capture in loop one | **Locked** |
| D9 | Instrument high-leverage points only | **Locked** |
| D10 | Legal non-negotiables in every spec | **Locked** (constitution) |

*Everything downstream (docs 02–16) is written to these decisions. If any decision must move, this document changes first and the suite follows.*
