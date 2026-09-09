# Services marketplace — audit and build plan

**Date:** 2026-09-08 · **Scope:** `src/modules/services/*`, the provider portal, the order surfaces, and the money paths that touch them · **Specs read:** doc 07 §§4, 6 (F-PROV-1…4, F-SVC-1…4), doc 09 §4, doc 10 §§3, 5, doc 08 S11/S13, doc 04 §§5–6.

## 1. What this audit is, and what it is not

T-021, T-022 and T-023 are built. The schema is sound, the state machine is real, the cash rail works, and 2168 tests pass against it. This audit is not a list of missing features against a wish list — it is an answer to one question: **can this marketplace actually take an order, deliver the service, and put the money where the business model says it goes?**

The answer is no, and the reasons are not evenly weighted. One of them stops the loop dead. Two of them mean the marketplace cannot participate in the owner-side economics that make it strategically worth having. The rest are refinement.

Everything below was verified by reading the code, not inferred from the specs.

## 2. The finding that changes the priority order

**A provider who accepts a job is never told where to go.**

`GET /api/provider/orders` returns each order through `serializeOrder`, which carries `id`, `status`, `scheduledStart/End`, `quantity`, `totalThb`, `refundAccruedThb`, `createdAt` and `serviceTitle`. The provider portal renders exactly that, plus the note and the SLA countdown. There is **no unit, no project, no address, and no customer contact** — before accepting or after.

Doc 07 F-PROV-3 is explicit: *"**Accept** → guest notified N-21, address details revealed."* The reveal does not exist. `grep` for `address_note` across `src/app/provider/` and `src/app/api/provider/` returns nothing.

This is not a missing nicety. It means the fulfilment handoff runs on a phone call outside the platform. Every order placed today requires a human to tell the provider the address, which destroys the record the platform exists to be, and makes the SLA, the no-show report and the rating all measurements of something that happened somewhere else.

**The cheap part:** the data is already on the order. `unit_id` and `address_note` are written at creation (`service-order.service.ts:209, 221`). Nothing needs to be captured — only revealed, at the right moment, to the right party. This is the smallest fix in the audit and the largest consequence.

## 3. The marketplace does not touch the owner-side economics

Two independent gaps, same root: **`orderer_role` is stored and never branched on for money.**

### 3.1 An owner's service order never reaches their statement

Doc 09 §4: *"the order form derives its context from the **role wearing the order** … so fulfilment knows where to go and money knows where to land (an owner-unit repair can be statement-charged; a guest transfer is paid directly)."* Doc 07 F-OWN-4: *"cost, if charged to the unit, appears as a ledger entry on the next statement."*

A service order writes exactly one ledger entry: `service_commission`, myUNO's own take (`ledger.service.ts:124`). `maintenance_cost` and `cleaning_cost` entries exist and are written **only** by the manual staff cost-recording flow (F-OPS-3) and the owner-stay turnover job. Nothing connects a service order to either.

So an owner ordering a deep clean for their own villa pays out of pocket exactly as a guest does, and ops must then re-key the same cost by hand to get it onto the statement — two records of one event, with no link between them, and no guarantee the second ever happens.

This is the gap that matters most strategically. The marketplace's value to Ignatev is not guest upsell margin; it is that **every cost and every service touching a unit lands in one ledger**, which is what makes an owner statement authoritative and the NOI real. Without this the marketplace is a gift shop bolted to the side of the platform.

### 3.2 No payout of any kind writes a ledger entry

`payout_owner` and `payout_provider` both exist in `LedgerEntryType`. Neither is ever written — verified by grep across `src/`, excluding seeds and tests. Recording a provider payout creates a `Payout` row and stops there; no ledger write appears anywhere in `src/app/api/admin/payouts/`.

Money leaves the business and the append-only ledger does not know. Doc 10 §4 requires every statement number to link to its source rows.

**This one is not the marketplace's.** It is a finance gap (T-031 territory) that the marketplace merely exposes, and it affects owner payouts identically. It is listed here because it was found here and should not be lost, not because it belongs in this plan.

## 4. The quality loop computes and never shows

- **Ratings are invisible.** `getServiceAverageRating` is implemented, exported from the module interface, and **called by nothing**. No catalog card, no service detail page, no provider card carries a rating. Doc 09 §4 says ratings *"roll up to provider averages (shown on cards)"* and calls this the quality loop. Guests currently choose a provider with no signal but the vetted badge.
- **No offender view.** Doc 09 §4: *"repeated no-shows/declines surface on the admin offender view."* No such view or count exists. A no-show raises a ticket against a single order; the pattern across orders is not assembled anywhere, so a bad provider is caught only if a human remembers.

## 5. Supply density — the thing doc 09 calls the moat — is unbuilt

Doc 09 §4, *Concentration effect (why this wins)*: *"Because orders cluster in projects, the provider's day is dense (v3 §5.4) — the order queue groups by project+date to make that visible to providers."*

- **The queue is a flat list.** No grouping by project, none by date. The provider cannot see that four jobs sit in one building on Tuesday, which is the entire argument for why they should prefer this platform over their own phone.
- **There is no capacity model at all.** `service-order.service.ts` contains no availability, slot, overlap or concurrency check — grep returns nothing. Advance notice *is* enforced (`api/service-orders/route.ts:66`), but beyond that a single cleaner can be sold fifty jobs at 10:00 on the same morning. Doc 07 F-SVC-2 assumes otherwise: *"⚠ Slot taken meanwhile → re-pick screen, nothing charged."*

Unmanaged density is worse than no density: the platform discovers the overbooking through a no-show report, refunds the guest, tickets the provider, and damages the relationship it was trying to build.

## 6. Recovery paths

- **No reschedule (F-SVC-3).** No service function, no route, no schema field, no UI. Cancel-and-rebook is the only path, which loses the provider, the slot and the money. This is the most-requested change in any real service business.
- **No alternatives rail.** Doc 07 F-PROV-3 and F-SVC-3 both promise *"a suggestion rail of alternatives"* after a decline or a provider cancel. A declined order is a dead end with a refund — demand the platform already earned, thrown away.
- **N-23 has no emitter.** The provider remittance notification is registered in doc 11 and never sent.

## 7. One decorative axis

`Service.fulfilmentMode` (`referred` / `operated`, Q3) is set at creation, returned by the detail API, and has content keys — and **nothing branches on it**. It is the same class of defect as `ServiceOrderStatus.closed` was before T-023b: a modelled distinction that changes no behaviour. Either Q3 gets ruled and the mode drives something real (who holds the customer relationship, who carries liability, whether the take-rate differs), or it should come out of the schema. A field that encodes a decision nobody has made teaches future readers a distinction the system does not honour.

## 8. What is genuinely solid

Worth stating, because the plan below builds on it rather than around it:

- The `project → unit → identity → role` spine holds throughout; orders carry `orderer_role`, `unit_id`, `project_id` and `booking_id` correctly.
- The order state machine is complete and tested, including expiry, decline, no-show and — since T-023b — a real terminal state.
- Vetting, the badge derived only from `vetted_at`, service approval with its own audit trail, and instant suspension via `Provider.status` all work as specified.
- Cash-first payment, server-computed totals, satang integers, take-rate snapshotting per order.
- Advance notice enforced server-side; MC authorisation and multi-project context have dedicated integration tests.

## 9. The plan

Sequenced by what unblocks the business, not by what is easiest. Each step is one task, one commit, one PR, in the working style of doc 16.

### Step 1 — Reveal the job to the provider *(the loop cannot close without it)*

Return unit, project, address and the reveal rule from the provider order APIs, and render them in the portal. Location details unlock on `accepted` per F-PROV-3; before acceptance the provider sees enough to decide (project and area, not the exact unit or the guest's name — a declined order must not leak a guest's address). Add the customer contact channel the provider needs at the door, through the existing `comms` thread rather than raw phone numbers, so the conversation stays on the platform and inside PDPA.

*Why first:* every other improvement is measuring a fulfilment that currently happens off-platform. Small diff, entirely additive, no schema change.

### Step 2 — Wire the owner money path *(makes the marketplace part of the business model)*

When `orderer_role` is an owner or MC role and the order carries a `unit_id`, the fulfilled order writes the cost as a `maintenance_cost` / `cleaning_cost` ledger entry against that unit, linked to the order, so it sweeps into the next statement. Guest orders keep paying directly and write nothing but the commission. The choice of *whether* a given order is charged to the unit is config, not code.

*Open first:* whether owner-charged orders are paid at order time or accrued to the statement (they cannot be both). This is a founder ruling and should go to `open_questions.md` before the code, because it decides whether the payment step is skipped for owner-role orders entirely.

### Step 3 — Make quality visible *(cheap, and it is already computed)*

Surface `getServiceAverageRating` on the catalog card, the service detail and the provider card. Build the admin offender view as a query over existing rows — no-shows and declines per provider over a configurable window, with a threshold that flags rather than auto-suspends. Suspension stays a human act.

*Why here:* two of the three pieces already exist. This is the highest ratio of trust gained to code written in the whole plan.

### Step 4 — Give services a capacity model *(before volume, not after)*

The smallest honest model: capacity per service per time window, checked inside the same transaction that creates the order, with the F-SVC-2 re-pick path when a slot goes while the orderer was deciding. Then group the provider queue by project and date, which is the concentration effect doc 09 promises and is nearly free once capacity exists.

*Why not earlier:* it is the largest diff here and it is only urgent under volume the platform does not yet have. But it must land before the first project runs at density, not after the first double-booking.

### Step 5 — Recovery paths

Reschedule (F-SVC-3) with provider re-confirmation; the alternatives rail on decline and provider-cancel; the N-23 emitter. All three are ordinary work once steps 1 and 4 exist — reschedule in particular is unbuildable in a sane way without a capacity model, which is why it sits here and not at the top despite being the most visible omission.

### Not in this plan

- **Payout ledger entries** (§3.2) — finance, not marketplace. Should be its own task; flagged so it is not lost.
- **Q3 / `fulfilmentMode`** — needs a founder ruling before it is either built on or removed. Not code work yet.
- **Q73** — remittance basis (`fulfilled` vs `closed`), raised by T-023b, still open.

## 10. The ordering argument, in one line

Close the loop (1), then make it earn its place in the business model (2), then make it trustworthy (3), then make it dense (4), then make it forgiving (5). Building 5 before 1 produces a marketplace that reschedules jobs nobody can find the address for.
