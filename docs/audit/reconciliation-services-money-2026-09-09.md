# Reconciliation evidence — services & order-to-money findings

**Date:** 2026-09-09 · **Against:** `feat/canonical-platform-v3` @ `e9094b4`, plus PR #65.
**Purpose:** `docs/canonical/RECONCILIATION.md` requires each baseline finding to be revalidated at current HEAD and classified `still valid / already fixed / partially fixed / not verified` before implementation, and its agent rule requires checking related PRs so no merged fix is duplicated. This file does that for the eight findings in the services and order-to-money area, with the evidence for each.

It covers **F04–F09** and **F15** only. The remaining findings are outside what I have direct evidence for and are left `not verified` here rather than guessed at.

## Classification

| Finding | Classification | Evidence |
|---|---|---|
| **F04** Order closure/completion not confirmed; recheck PR #63 | **Already fixed** | PR #63 merged into v3 as `89f4545`. `ServiceOrderStatus.closed` is now written by `confirmServiceOrderFulfilment` (orderer confirms early) and `closeSettledServiceOrders` (nightly sweep past `[cfg] service.fulfilment_confirm_window_hours`, default 48). `closed_at` / `closed_by_identity_id` distinguish a confirmation from a lapse. 18 integration tests in `src/modules/services/order-close-window.integration.test.ts`. |
| **F05** Commission accrual and remittance must use the same accepted terms snapshot | **Already fixed** | `ffbc2d7`. `computeProviderRemittance` now sums `Math.round(order.total_thb * order.take_rate_pct_snapshot / 100)` per order instead of reading live `services.take_rate_pct`. Matches `SERVICES_MARKETPLACE.md` §23. |
| **F06** Remittance eligibility must not depend on `updatedAt` or one narrow status | **Already fixed** | `ffbc2d7`. Period filter moved to immutable `fulfilled_at`; eligibility widened to `status in ('fulfilled','closed')`; undecided disputes hold their order out. Directly implements §23's "immutable recognition/fulfillment date, not `updatedAt`". **Its tests did not prove it until PR #65** — three fixtures still dated orders by `updatedAt` and one asserted the old live-config rate, so the suite was red; a fourth (`5c03b9c`'s dispute-hold test) threw on a `category`/`categoryKey` field error before asserting anything. |
| **F07** Fulfillment state + earning creation must be atomic/idempotent | **Already fixed, with a residue** | `2727f11` → `88b63ee` → `0fdf492` add `fulfillServiceOrderAtomic` and wire `POST /api/service-orders/[id]/fulfil` to it. **Residue:** the superseded non-atomic `fulfillServiceOrder` still exists and is still exported from `src/modules/services/index.ts`. It has no production caller, but it carries the more natural name, so anything importing from the module interface gets the unsafe path by default. See *Duplicate implementations* below. |
| **F08** Dispute/ticket creation and acceptance window need atomic policy-aware handling | **Already fixed** | PR #63 (`d3c532c`). `raiseDispute` and `closeSettledServiceOrders` take the same `SELECT … FOR UPDATE` row lock on `service_order` and re-check under it, so the sweep and a late dispute cannot both succeed; `raiseTicket` moved inside that transaction, which also stopped a failed `dispute.create` orphaning a complaint ticket. The window itself is config-driven and enforced at the seam, not only in the page. |
| **F09** Reschedule requires first-class workflow, not cancel-and-recreate | **Still valid** | No service function, route, schema field or UI exists. `grep` for reschedule across `src/modules/services` and `src/app/api/service-orders` returns nothing. Cancel-and-rebook remains the only path. `SERVICES_MARKETPLACE.md` §14 specifies a considerably more careful design than the old doc 07 F-SVC-3 — hold the replacement before releasing the old capacity — and that ordering cannot be built without the capacity model, which also does not exist (see below). |
| **F15** Build/install migration-history mutation is unsafe | **Partially fixed — the fix introduced a regression** | `ef4ffb9` correctly removed `scripts/repair-failed-migrations.mjs` from `postinstall` and `build`. In the same commit it also deleted **seven `devDependencies`** (`autoprefixer`, `postcss`, `eslint`, `eslint-config-next`, `eslint-plugin-local-rules`, `jsdom`, `@vitest/ui`) without regenerating `package-lock.json`, which still declared all seven. Result: **no v3-family branch could build.** Every deployment across #64, #65, #66, #67 and #68 failed with `Cannot find module 'autoprefixer'`. Restored in PR #65 `6957cdb`, verified by the first successful deployment in the project's recent history. |

## Two duplicate implementations, both dangerous by name

The same shape has now occurred twice: a superseded implementation left in place, sharing the name and signature of the canonical one.

1. **`src/app/libs/payouts.ts`** — a second `computeProviderRemittance` that nothing imports. It still carries the `updatedAt` period basis and the live-config take rate that `ffbc2d7` fixed, and it drops `closed` orders. Dead today; wrong the moment anyone wires it up.
2. **`fulfillServiceOrder`** in `service-order.service.ts` — superseded by `fulfillServiceOrderAtomic` but still exported from the module's public interface. A caller reaching for the obvious name gets the version that can leave a fulfilled order with no commission row.

Neither is a live defect. Both are traps of exactly the kind `ARCHITECTURE.md`'s single-interface rule exists to prevent, and both should be removed or redirected rather than left as documentation of history.

## The `fulfilled`-means-delivered assumption

Adding `closed` created a class of defect worth recording, because it recurred three times before it was contained:

1. Provider remittance dropped closed orders — a provider never paid for delivered work (`ffbc2d7`).
2. The review prompt never fired for them, so every early-confirmed order silently lost its rating request (PR #65).
3. Rating itself refused them, so the prompt that was then sent led to `Cannot rate order in closed status` (PR #65, found in review).

The rule, now recorded as a CodeRabbit learning on this repository: **`closed` is delivered work; `cancelled`, `declined`, `expired` and `failed` are not.** Any query filtering on `fulfilled` alone must be re-examined against that distinction. `SERVICES_MARKETPLACE.md` §13 goes further and says these dimensions — commercial acceptance, fulfillment, payment, dispute, settlement, administrative closure — should be independent rather than one enum. The single `status` column is why one added value could break three unrelated readers.

## What the canonical spec adds beyond the old audit

`docs/audit/services-marketplace-2026-09-08.md` was written against docs 07/09/10. Where `SERVICES_MARKETPLACE.md` supersedes it:

- **§3 fulfillment modes** — six modes (`INSTANT`, `REQUEST_CONFIRMATION`, `QUOTE`, `CONCIERGE`, `REFERRAL`, `INTERNAL_PROPERTY_SERVICE`) replace the two-value `referred`/`operated` field. This answers the open question of whether that field decides anything: it must, and the enum has to expand. The `CONCIERGE` mode is the operating model for launch.
- **§8 contextual ordering** — "Owner repair: Owner + Unit → Order → owner finance" confirms the direction of the owner-order money path the old audit raised. Whether an owner order is paid at order time or accrued to the statement is still not stated and remains a founder decision.
- **§7 standalone commerce** — `project_id` may be null on an order. Today the column is required. This is a schema change, and the spec explicitly forbids the workaround of a synthetic "All Phuket" project.
- **§11 quantity dimensions** — today's single `quantity` integer is called out directly as conflating persons, duration, product count and capacity.
- **§22 provider workspace** — the provider still cannot see a job's unit, project or address at all, before or after accepting. This remains the gap that makes fulfilment happen off-platform.
- **§24 quality** — ratings are computed by `getServiceAverageRating` and displayed nowhere; the spec asks for response, acceptance, on-time, no-show, complaint and refund measures, and says explicitly not to rank on average stars alone.
- **Capacity** — no capacity model exists anywhere in the services module. §14 (reschedule), §19 (one physical item, one capacity calendar) and §21 (recurring occurrences) all depend on one.

## Suggested next work, in canonical Phase order

`ROADMAP.md` Phase 1 is "complete service-order lifecycle; align commission/remittance snapshots; correct settlement period/eligibility; harden fulfillment/cancel/dispute concurrency". **On this evidence Phase 1's services and money items are done**, once PR #65 lands: F04, F05, F06, F07 and F08 are all closed, and F15's regression is repaired.

That places the next services work in **Phase 5 — Marketplace completion**, whose first prerequisites are the provider workspace (§22) and a capacity model, because reschedule (§14), alternatives (§15) and recurring services (§21) all sit on top of them.
