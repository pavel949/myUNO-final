# PMS pricing and restrictions audit — 2026-10-08 (Asia/Bangkok)

Baseline: `pavel949/myUNO-final`, main `e92f4a0080ac97698e77ad7b11f70170dfd0455d`.
Scope: rate setup and effective prices for one home, a condominium portfolio, and a resort/category such as Layantara. This is the source and existing-test part of the parallel PMS audit. It is **not** a claim that the authenticated production screens were clicked or that production tariffs were changed. The parent audit supplies runtime/screenshots separately.

## Verdict

The rate calculation core and a seasonal editor exist. A super-admin can set one home's daily/monthly/yearly grid, or overwrite all category members from that home. Ordinary scoped resort staff cannot use that editor: it is admin-only while their unit calendar still advertises overrides that grid-priced villas reject. There is no first-class resort revenue workspace, category inheritance editor or safe bulk change review. Production suitability for resort revenue management is therefore **partial, not verified**.

## Task/surface map

| Step | User task | Implemented surface | Source health | Runtime evidence |
|---|---|---|---|---|
| 1 | Open project inventory | `/app/admin/projects/[id]/inventory` → unit | Admin-only; category base displayed | Not checked in this subaudit |
| 2 | Set canonical category BAR | `/app/admin/properties/[id]/onboarding`, step 6 | Name/minimum only; category amount lives in step 2 | Not checked |
| 3 | Set seasons/monthly/yearly for a unit | `/app/admin/units/[id]`, Rates and seasons | Real writer, validation/audit; error/policy defects below | Not checked |
| 4 | Set category seasons | Same unit screen, Save for all category villas | Full copy, no shared inheritance/diff | Not checked |
| 5 | Inspect effective date rates | `/ops/calendar/board` project/category/unit filters | Canonical daily projection; two parity tests pass | Not checked |
| 6 | Create manual availability blocks | `/ops/calendar/[unitId]`, shared AvailabilityPricingPanel | Real scoped availability writer; separate from rates | Not checked |
| 7 | Set dated price exception | Same shared panel | Supported for ordinary units; grid-priced units return 409 | Not checked |
| 8 | Preview saved seasonal price | Unit admin tariff preview | Pure grid subtotal/policy preview; not full live quote readiness | Not checked |
| 9 | Set project seasonal/discount config | `/app/admin/config?projectId=...` | JSON editor, advanced/admin tool | Not checked |
| 10 | Operate resort restrictions/channels | Onboarding channel mapping + calendar warning | iCal/manual explicitly do not push ARI; no dedicated CTA/CTD/stop-sell editor found | Not checked |

## Implemented price precedence

1. **Validated active commercial tariff grid**: daily stays below 30 nights; explicit active monthly offering/grid from 30 nights; annual minimum switches to lease request. Source Layantara rows additionally require verified booking policies. Grid pricing ignores PricingRule and BAR adjustments.
2. **Ordinary canonical inventory path**: BAR scope resolves unit → category → project. Base amount is category first, unit compatibility fallback. Dated PricingRule precedes seasonal category/config price, then BAR adjustment is applied. Arrival override may change minimum stay. LOS/early-bird/fees are then computed; legacy monthly category behavior begins at 28 nights.
3. **Calendar**: projects daily rates through the canonical quote engine with calendarProjection; a 30-day viewport is not quoted as a monthly stay.
4. **Preview**: admin tariff preview reads saved CommercialOffering grid directly, not the current unsaved form and not the complete canonical/public booking gate.

Readers/writers: `src/modules/core/canonical-pricing.service.ts`, `src/modules/core/tariff-editor.ts`, `src/modules/core/seasonal-tariff.ts`, `src/modules/core/commercial-booking-terms.ts`, `src/app/api/admin/units/[id]/tariff/route.ts`, `src/app/api/admin/units/[id]/tariff-preview/route.ts`, `src/app/api/units/[unitId]/pricing-rules/route.ts`.

## Findings ordered by impact

### R1 — Scoped resort staff have a rate-management dead end (high)

`src/app/ops/calendar/[unitId]/page.tsx` embeds AvailabilityPricingPanel for project staff. POST pricing-rules detects usesTariffGrid and returns 409: “This villa is priced by seasons. Change its rates in ‘Rates and seasons’.” That seasonal editor and its GET/PUT API require admin, not the scoped pricing permission. The ops page provides no seasonal-editor link. Thus a valid staff pricing task has visible inputs but an inaccessible destination.

Recommendation: expose the correct editor from a scoped Pricing & Restrictions workspace; authorize writes by unit/category function authority. For grid units, replace the ineffective override form with effective grid summary and a reachable permitted action. Do not weaken the current guard as a shortcut.

### R2 — “Use standard policy” does not clear the saved refund ladder (high)

TariffEditorClient sets cancellationSteps to null. `saveTariffDraft` copies the existing policy and assigns cancellation_steps only when `s.cancellationSteps` is truthy. The old ladder is preserved. The UI promise and saved guest cancellation terms can diverge.

Evidence: `src/app/(admin)/app/admin/units/[id]/tariff-editor-client.tsx` clear_steps action; `src/modules/core/tariff-editor.ts` bookingPolicies update. The existing integration test checks setting a ladder, not clearing one.

Recommendation: define null as explicit revert and remove/null the stored ladder, with a policy-preview regression test and historical booking snapshot preservation.

### R3 — Adding/renaming a source season can save an unquotable stay (high)

The editor allows season codes to change and adds seasons. Validation checks grid coverage/overlap/amount only. The writer only updates existing bookingPolicies with the same mode/season; it neither remaps renamed policies nor creates approved complete policy terms. For source-owned Layantara rows, canonical quoting requires a matching specific or generic project policy and fails closed when absent. Save can show success although affected dates cannot quote.

Recommendation: validate policy resolution for every proposed season before applying; offer explicit policy reuse/remap with preview. Preserve fail-closed booking behavior.

### R4 — Category apply silently overwrites unit-specific rates (high UX risk)

The category button sends scope:category from a unit draft. The API resolves every nonoffboarded category unit and transactionally copies daily/monthly/yearly rows and all inclusion flags. It does not show member names, divergent unit tariffs, exceptions, or old/new dates/amounts before apply; no version precondition detects stale edits. A missing category falls back to unit save. This is copying, not inheritance.

Recommendation: separate scope selection from editing, show category name and exact member count/list, preview changed dates/rates and overridden exceptions, choose preserve-exceptions or explicit overwrite, check expected revision, audit the reviewed batch. Resort teams need one source category rate with visible inherited unit exceptions.

### R5 — Loading and save failures can strand the editor (medium)

GET fetch does not check response.ok: an error JSON sets draft undefined and state idle, leaving the loading presentation indefinitely. Save fetch has no try/catch/finally: a network rejection leaves state saving and disables both buttons indefinitely. Validation errors also remain after local edits until a successful save.

Recommendation: check HTTP status, catch transport failures, restore editable state and preserve draft; show retry and validation attached to offending fields, revalidate the local draft. Abort stale requests if unit changes.

### R6 — Manual override form can lose input and throw after submission (medium)

AvailabilityPricingPanel price form resets regardless of whether act returns false on failed write; both block/price forms access event.currentTarget in an async continuation, where React currentTarget is no longer the form. A failed price save may remove entered dates/rate; a successful write may report a client error despite the saved row.

Recommendation: capture the HTMLFormElement synchronously; reset only on confirmed success. Add real failed-request/retry component coverage.

### R7 — Preview cannot confirm the edited proposal or full guest quote (medium)

Editor and preview have independent state. Preview POST reads persisted grid, so editing a price and clicking preview still shows the old saved amount. Displayed total is subtotal/illustrative lease amount; full canonical taxes/fees and public readiness are not represented. bookable:true is derived from offering.status active alone, not the complete booking gates. Source policy minimum is resolved but not enforced against the preview stay length.

Recommendation: clearly separate “preview proposed changes” and “current guest quote”; preview draft without writing, show fees/total/minimum/policies and explicit reasons booking is unavailable. Do not label active-offering alone as full bookability.

### R8 — Pricing configuration is split across four places (medium UX)

Category amount: onboarding step 2; BAR name/minimum: step 6; seasons/monthly/yearly: nested unit admin page; project season/LOS/early-bird/fees: JSON config. ProjectWorkspaceNav has Overview/Experience/Media/Inventory/Calendar/Concierge/Preview, no Pricing. A category inventory header shows its base amount even when the effective villa price comes from a commercial grid.

Recommendation: one Pricing & Restrictions tab scoped by property/category/unit, effective-source badge, inherited value, exceptions, day/month/year context, preview and apply. Onboarding should link to that workspace rather than become the ongoing resort tariff editor.

### R9 — Advanced rate-plan hierarchy/restrictions are incomplete in UI (medium scope gap)

RatePlan schema stores parent plan, adjustment type/value and cancellation key; catalog API accepts them for unit/category. Current onboarding form exposes BAR name/minimum only, and canonical booking pricing resolves BAR only. Existing revenue-tariff-engine supports alternate codes in its module/test, but no callable public booking/pricing route integration was found using that resolver. Project-scoped BAR is read by pricing yet catalog rate_plan writer requires category or unit.

No dedicated UI for derived/nonrefundable plans, occupancy-based rules, closed-to-arrival/departure, maximum stay, category stop-sell, or a calendar bulk rate/restriction apply was identified. This is a missing operational surface, not proof that a requested hidden API is broken.

Recommendation: choose supported commercial policy explicitly, wire selected plan through the canonical quote/booking seam, and add restrictions only with inventory/concurrency and acceptance tests. Do not imply iCal delivers rates/restrictions.

### R10 — Technical date and error entry adds operator effort (lower UX)

Season windows use free-text recurring MM-DD, not a date/window picker. Errors are a list at the bottom after submit; gaps show a count and only four dates, with no calendar visualization. Money fields are labelled THB and correctly convert once to satang; this is a strength. Some guidance refers to villas even for condominium units. Admin configuration uses parameter keys and raw JSON textareas.

Recommendation: recurring season calendar with named presets, coverage/overlap visualization, inline errors, unit-neutral labels, localized user-facing error mapping. Keep raw JSON for exceptional advanced administration.

## Existing checks run

Command: `npx vitest run src/modules/core/seasonal-tariff.test.ts src/modules/core/canonical-calendar-rate.test.ts src/modules/booking/revenue-tariff-engine.test.ts`.

Result: **3 files, 15 tests passed**. Covers year-boundary seasons, integer monthly allocation, annual-request semantics, daily calendar/quote parity and standalone effective-rate resolver scenarios. This does not prove save/preview UI or production data readiness.

`src/modules/core/tariff-editor.integration.test.ts` and DB-backed canonical pricing/onboarding integrations were inspected, **not run**: DATABASE_URL_TEST is unavailable; their resetDb deletes test data and must not point at production. No production reads through a database client or writes, no booking/price/status changes, no migration or deployment performed by this subaudit.

## Evidence limits / next runtime acceptance

- Parent browser pass must verify admin and scoped revenue/ops roles for Layantara, a condominium and a single unit, with saved current-run screenshots.
- Missing login/session means these source findings are not a substitute for “clicked all screens.” No overlap/mobile/color contrast claims are made here.
- Verify correct seasonal affordance, scope persistence when switching properties/categories, deterministic retry after HTTP/network failures, price-preview clarity, and category member/exceptions review.
- In isolated test data, test clear-ladder, add/rename source season, stale concurrent edits, failed save recovery, full canonical guest quote parity and historical booking immutability before any live tariff changes.

## Implemented after audit authorization

The original findings above describe baseline e92f4a0. A subsequent user instruction authorized fixes. The following limited corrections are now implemented locally, pending the parent release/runtime pass:

- R2: explicit cancellationSteps:null removes only the stored season refund ladder; omission preserves it. Other policy terms and historical booking records are untouched.
- R5: tariff GET checks status and payload, renders failure rather than endless loading, aborts stale loads; failed PUT restores controls and preserves the edited draft for retry. Invalid success responses cannot show saved.
- R6: both manual forms capture their element before awaiting; price fields reset only after confirmed success.

Verification: six files / **24 tests passed** including nine new regression checks for HTTP/malformed load, network save retry with preserved amount, invalid success response, stale load abort, explicit policy reset versus omitted field, failed manual write preservation, successful asynchronous reset. Selected changed source/test ESLint passed. No production tariff writes, broader authority change, category inheritance redesign or new-season policy change were made.
