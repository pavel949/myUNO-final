# Platform Maturity Assessment

**Date:** 2026-08-18 · **Head:** `163f1a9` · Method: read against the running code and the
1318-test suite, not against the specification.

## The scale

| Level | Meaning |
|---|---|
| **L0** | Absent — nothing exists |
| **L1** | Documented only — a spec describes it; no code |
| **L2** | Scaffolded — types, routes or a stub exist; no real behaviour |
| **L3** | Working — real behaviour, happy path tested |
| **L4** | Hardened — unhappy paths, concurrency and constraints tested; the database enforces the invariant, not just the code |
| **L5** | Proven — running in production under real load |

**Nothing in this platform is L5.** It has never taken a real booking or a real baht. Every
statement below is about code quality and test evidence, not operational track record — that
distinction is the single most important thing in this document.

Scale of the thing being assessed: **72 models · 17 modules · 138 API routes · 62 pages ·
17 migrations · 92 test files · 1318 tests**.

---

## A. Data models

| Domain | Level | Why |
|---|---|---|
| Identity & roles | **L4** | `RoleAssignment` scoped to project/unit; deny-by-default `core.can()`; a 978-line table-driven permission matrix |
| Booking | **L4** | State machine, GiST exclusion constraint, advisory lock, immutable financial snapshot — all proven by drop-and-rerun |
| Ownership | **L4** | `OwnershipPeriod` with effective dates and an overlap exclusion constraint (added this session) |
| CRM | **L4** | Profiles, opportunities, activities, consent, lifecycle transition log — the most complete domain in the repo |
| Inventory | **L3** | `BlockedDate` and `PricingRule` work and are honoured everywhere. No inventory pools, no availability projection, no `InventoryEvent` |
| Money | **L3** | `Payment`, `LedgerEntry`, `OwnerStatement` with two-signature sign-off; snapshots now immutable. Ledger is **single-entry**, not double-entry |
| Comms | **L3** | Threads, messages, tickets, announcements, notifications all real |
| Compliance & ops | **L3** | `ComplianceRecord`, `ConditionReport`, TM30 with SLA escalation |
| **Project** | **L2** | The weakest core entity. One `address` string, no country/city/district as fields, **no structural hierarchy at all** — no building, zone, floor or wing. `Unit.floor` is free text |
| **Sellable class** | **L2** | `categoryKey String?` — a nullable string, not a `UnitType` entity. Two units in a category share nothing structurally; there is nowhere to hold the category's name, photos or standard occupancy |
| Amenities | **L2** | Validated against a config catalog, so not free-form — but two independent `String[]` arrays on Project and Unit with **no inheritance and no provenance** |
| Rate plans | **L0** | No `RatePlan`, no `RateRule`, no `RestrictionRule`. Price lives on `Unit.baseNightlyThb` plus dated `PricingRule` overrides |
| Multi-unit booking | **L0** | No `BookingItem`. One booking is one unit; a family taking three villas is three unrelated bookings |
| Persisted quote | **L0** | No `Quote`. Price shown at search is recomputed at booking with nothing revalidating in between |
| Tenancy | **L0** | No `organization_id` on Identity/Project/Unit/Booking/Ledger. Isolation is project/unit scoping only |

**Read:** the transactional core is strong; the descriptive catalog is thin. The platform can safely
sell a night, and struggles to describe what it is selling.

---

## B. Flows

| Flow | Level | Note |
|---|---|---|
| Search → availability | **L4** | Bookings, blocks, holds and hold-expiry all honoured; one set-based query |
| Book (specific unit) | **L4** | Transaction + advisory lock + exclusion constraint; concurrency proven |
| Book (category) | **L4** | Falls through to the next free villa on a lost race rather than refusing the guest |
| Extend a stay | **L4** | Atomic, locked, blocked-dates checked, history written in the same transaction (this session) |
| Cancel / refund | **L3** | Policy snapshot, refund computation, ledger entries — happy paths tested |
| Owner statement → sign-off | **L4** | Two-signature state machine with `SELECT … FOR UPDATE`, owner isolation proven by 404-not-403 |
| Service order | **L3** | Order, accept, fulfil, remit — works; provider remittance has a known disagreement (**Q34**) |
| Guest verification / TM30 | **L3** | SLA object with escalation; unhappy paths specified and built |
| OTA import | **L3** | Real fetch, parse, idempotent import, conflicts raised to ops (this session) |
| **Pay (non-cash)** | **L1** | Cash only. The provider seam fails closed; no real rail, no webhook route, no idempotency table |
| **OTA push** | **L0** | Availability is read from channels, never written to them. **A direct booking does not close the villa on Airbnb** |
| Housekeeping / task generation | **L0** | No `Task` entity; operational work is not generated from stay events |

**The two gaps that matter commercially:** you cannot take a card, and selling here does not stop the
same night selling on Airbnb. Both are known and neither is a defect — they are unbuilt.

---

## C. Modules

Test files per module, as a proxy for how much of each is actually pinned:

| Module | Files | Test files | Read |
|---|---|---|---|
| booking | 5 | 8 | Most heavily tested area, appropriately |
| finance | 9 | 8 | Strong |
| core | 11 | 8 | Strong |
| projects | 7 | 7 | Strong |
| comms | 9 | 5 | Adequate |
| ops | 5 | 4 | Adequate |
| analytics · config · integrations · services | 8/6/8/5 | 3 each | Thin but present |
| content · auth | 8/7 | 2 each | **Thin for auth**, which guards everything |
| crm | 3 | 1 | Thin relative to its surface |
| **audit** | 2 | **0** | Zero tests on the module that records who did what |
| **media** | 2 | **0** | Zero tests; handles uploads |
| **browse** | 1 | **0** | Zero tests |
| **compliance** | 1 | **0** | Zero tests — but the legal gate it serves *is* tested, in `projects` |

---

## D. Cross-cutting

| Concern | Level | Note |
|---|---|---|
| Authorization | **L4** | Deny-by-default, server-side in every query, table-driven matrix |
| Owner data isolation | **L4** | Scoped in the WHERE clause; another owner's statement 404s |
| Encryption | **L3** | Real AES-256-GCM. No KDF, no AAD, no key version — so **the key cannot be rotated** |
| Audit trail | **L4** | Append-only by database trigger (this session) |
| Financial immutability | **L4** | Snapshot frozen by trigger; the spec's mandatory financial test passes |
| Logging & correlation | **L3** | Structured, correlated, PII-scrubbed (this session) |
| **Alerting** | **L0** | Nothing pages anyone. No drain, no vendor, no threshold |
| **Backup & restore** | **L0** | Nothing documented, nothing rehearsed |
| Rate limiting | **L2** | In-memory `Map` — useless across serverless instances |
| Performance | **L2** | Indexes on hot paths; no load test, no availability projection, no query budget |
| CI | **L2** | Workflow is correct and was passing; **GitHub Actions has created no run since `e8cc14c`** — an account-side issue, so the last several commits are locally verified only |

---

## E. Verdict

**Loop one is buildable-complete and safe on its invariants. The platform is not launch-ready, and
the reasons are almost entirely operational rather than architectural.**

What genuinely stands in the way, in order:

1. **No backup or restore drill.** Everything else assumes the data survives. Immutable audit trails
   and frozen financial snapshots are worth nothing if the database is gone.
2. **No alerting.** Failures are now findable, but only by someone who already went looking.
3. **Cash only.** A card rail with genuine signature verification and an idempotency table.
4. **Encryption key cannot be rotated.** No key version prefix, and `ENCRYPTION_KEY` is immutable
   once it holds data — so a leak today is unrecoverable without losing every encrypted passport.
5. **A direct booking does not close the night on Airbnb.** Import without push is half a channel
   manager, and the missing half is the one that prevents double-selling.

What does **not** stand in the way, despite looking like it might: the thin Project and UnitType
models. They limit how well the platform *describes* inventory, not whether it can safely sell it.
Fixing them is a P1/P2 refactor, not a launch blocker.

**The honest summary:** the parts that would lose money quietly — double-booking, oversold blocks,
mutable financial records, forged payments, leaked calendars — have been closed and proven. The parts
that remain are the ones that are obvious the moment they bite, and every one of them needs a decision
or a credential from the founder rather than more code.
