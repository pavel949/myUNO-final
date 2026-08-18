# Property onboarding — what exists, and where it stops

**What this is.** A step-by-step check of the property onboarding flow (doc 07 **F-OWN-1**, "Owner onboarding & mobilization") against what the application can actually do: what an admin can reach in the UI, and what reaches the database. Every claim below names a file.

**Method.** For each entity the flow writes, every non-test write site was located, then every caller of that write traced back to an HTTP route and a screen. A function that exists but nothing calls is recorded as unreachable, not as built.

Verified 2026-08-18 against `src/` at `938550b` + the area work.

---

## 1. Verdict

**The flow is roughly half wired.** A unit can be created and put live through the application; it can then take bookings. But **four of the seven specified steps have no path to the database at all**, and the one that matters commercially — recording the engagement — is among them.

The consequence is concrete: a property onboarded entirely through the app **can never produce an owner statement**. Statement generation refuses a unit with no active engagement (`src/app/api/admin/statements/generate/route.ts:98`), correctly per doc 10 §4 — and nothing in the application can create an engagement.

So the loop does not close. Stays work; the owner-side promise the business is built on does not, without direct database access.

## 2. The seven steps, measured

| # | Step (doc 07 F-OWN-1) | Writes | Service exists | HTTP route | UI | Reachable end to end |
|---|---|---|---|---|---|---|
| 1 | **Qualify** — Project + Unit(draft) + owner Identity | `Project`, `Unit` | ✅ | ✅ `POST /api/admin/projects`, `POST /api/admin/units` | Project ✅ · **Unit ✗** | Partly — a unit can only be created by calling the API directly |
| 2 | **Mandate** — `UnitEngagement`, NOI cap, fee overrides | `UnitEngagement` | ✅ `createUnitEngagement` | **✗ none** | **✗** | **No** |
| 3 | **Legal audit** — `ComplianceRecord(permitted_use)` + title docs | `ComplianceRecord` | ✅ `createComplianceRecord` | **✗ none** | **✗** | **No** |
| 4 | **Condition survey** — baseline `ConditionReport` | `ConditionReport` | ✅ | ✗ for mobilization | ✗ | **No** — the only writer is guest check-in (`api/bookings/[id]/checkin/route.ts:98`), which is the *operational* report, not the baseline survey |
| 5 | **Standards uplift** — checklist item + notes/photos | `MobilizationChecklistItem` | ✅ `completeMobilizationStep` | **✗ none** | **✗** | **No** |
| 6 | **Pricing setup** — rates, policy, photos, amenities | `Unit`, `PricingRule` | ✅ | ✅ `PUT /api/admin/units/[id]`, media route | Partly | Yes for the unit fields and cover photo |
| 7 | **Go-live** — checklist complete + permitted use → `live` | `Unit.status` | ✅ | ✅ `POST …/confirm-permitted-use`, `PUT …/[id]` | ✅ | Yes — **but see §4** |

## 3. What is genuinely well built

Worth stating plainly, because the gaps below are about reach, not quality.

- **The permitted-use gate holds.** `createUnit` refuses to create a unit `live` outright (`units.ts:100`) — the comment records that `POST /api/admin/units` spreads the request body straight through, so `{"status":"live"}` once created a bookable unit that had never been cleared. Going live is a transition through `updateUnit`, where the gate lives.
- **The mobilization gate logic is real and ordered.** `checkMobilizationGate` enforces step order, and `completeMobilizationStep` calls it (`compliance.service.ts:233`). The rule that no step advances past a blocked one is implemented.
- **Taxonomy keys are validated** against their doc 04 §8 catalogs on create (`assertCatalogKeys`).
- **Ownership is recorded as a dated fact** from the day a unit exists (`ensureOwnershipRecorded`), idempotently.
- **The owner dashboard already reads** compliance records and the mobilization checklist (`owner.service.ts:557,560`).

That last point is the sharpest expression of the problem: **the owner dashboard renders a mobilization checklist and a compliance list that nothing in the application can create or advance.** It is a read view over data only a seed or a hand-written SQL statement can produce.

## 4. Findings, ranked

### O-1 · No way to record an engagement — blocks every owner statement
`createUnitEngagement` / `updateUnitEngagement` (`src/modules/core/engagement.service.ts`) have **zero callers** outside tests. The only engagements that exist anywhere are written by `src/modules/core/seed.ts:390-416`.

Without one, `POST /api/admin/statements/generate` returns *"Unit has no active engagement configuration"*. The engagement also selects the owner/estate split (doc 02 §2.6) and carries `noi_cap_annual_thb`, which doc 07 marks **required, no default** (Q14). This is the single break that stops onboarding from closing.

### O-2 · No way to record compliance — the legal-audit step cannot be performed
`createComplianceRecord`, `updateComplianceRecord`, `deleteComplianceRecord` have zero callers. There is no `/api/admin/compliance-records` route. (`/api/admin/compliance-checklists` is a different thing — the recurring *operational* checklist, `ComplianceChecklistTemplate`/`Instance`.)

Note the interaction with §3: `permittedUseConfirmedAt` on the unit **can** be set from the UI, and that is what gates go-live. So a unit can be marked permitted-use-confirmed **with no `ComplianceRecord` behind it** — the confirmation exists as a timestamp with no evidence attached, which is exactly what ClearView's proof-of-evidence mandate (CLAUDE.md) is meant to prevent.

### O-3 · No way to start or advance the mobilization checklist
`initializeMobilizationChecklist` and `completeMobilizationStep` have zero callers. `createUnit` does not initialize a checklist, so **a newly created unit has none at all** — the gate logic is sound but never runs, and `isMobilizationComplete` is never consulted before go-live.

### O-4 · A unit's owner cannot be set or changed after creation
`UpdateUnitInput` (`units.ts`) has no `ownerIdentityId` field, and `setUnitOwner` (`ownership.service.ts`) has **zero callers**. An owner can only be attached in the `POST /api/admin/units` body. A sale, a transfer, or a correction is not expressible through the application — which also means the chain-of-title model has no way to gain its second period.

### O-5 · No UI creates a unit
`/app/admin/units` lists units and offers confirm-permitted-use, set-live, pause, and set-photo (`units-client.tsx:52-78`). There is no create form. Only `/app/admin/projects` can create anything (`projects-client.tsx:69`). Units must be POSTed by hand.

### O-6 · The asset-status route writes without an audit trail
`PUT /api/admin/units/[id]/status` changes `assetStatus` (managed / verified_partner / one_off_sourced / suspended) and records `assetStatusReason` on the row — but writes no `AuditLog` entry, unlike `createUnit`/`updateUnit`. CLAUDE.md's audit-logging section expects state changes to be traceable to an actor. The reason text is captured; who set it is not.

## 5. What this means

Loop one is stays, and stays are unaffected: a unit created through the API can be priced, cleared, put live, and booked. Every finding above is on the **owner-side and evidence-side** of the flow — the half that makes myUNO an operating platform rather than a booking site.

The work is mostly *connection*, not construction: the services for O-1, O-2, O-3 and O-4 are written, ordered, and in several cases tested. What is missing is the routes and the screens to reach them. That is a smaller job than the gap list suggests, and it is mechanism rather than invention — with two exceptions worth the founder's ruling, logged as **Q42** and **Q43**:

- whether permitted-use confirmation should be *refused* until a `ComplianceRecord(permitted_use)` exists (O-2 makes the timestamp free-standing today), and
- whether go-live should be gated on `isMobilizationComplete`, which the spec implies but no code enforces.

Both tighten a legal gate, so neither should be guessed.

---

*Companion to `PLATFORM_MATURITY.md` and `AIRBNB_PARITY.md`. Findings are reach findings: a service that exists but nothing calls is recorded as unreachable, not as built.*
