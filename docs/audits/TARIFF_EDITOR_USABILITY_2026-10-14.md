# Annual tariff editor usability slice

> **Исторический отчёт / evidence прежнего среза.** Не является текущим статусом main или production. Актуальное [описание системы](../current/SYSTEM.md) и [реализация / остаток](../current/IMPLEMENTATION_STATUS.md) сверены 2026-10-16. Команды и результаты ниже относятся только к исходному контексту отчёта.

Baseline: `7b29b4728961f583028d6b3350d7505fdcd05965`. Scope: the existing admin unit page and the same CommercialOffering tariff writer and booking calculator. No migration, deployment, source cutover, payment or historical-booking changes.

## User path

1. Open `/app/admin/units/:id#unit-tariffs`.
2. Start with a year-round rate, or edit the existing base row. Enter a real approved price in THB.
3. Add seasonal rows with explicit inclusive annual MM-DD windows and prices.
4. On the base row choose **Use for dates outside other seasons**, review current/proposed windows, then apply to the draft. This is an explicit calendar transformation, not a new pricing precedence or inherited rule. Other rows, money and terms are unchanged.
5. Save for the unit and reload. Preview uses saved data; changes while a save is pending are disabled. A saved tariff invalidates an earlier quote preview.
6. Active stay offers call `computeCanonicalPriceBreakdown`, the same service used by booking, including its taxes, fees, discounts and source-policy gates. Draft grids expose a clearly labelled accommodation subtotal only. Neither output asserts availability or booking eligibility.
7. Guest dates and a resulting booking must be checked in isolated Chromium against the same saved total before merge readiness.

## Reconciliation

- Preserve: `CommercialOffering.pricingTerms.tariffGrid`, seasonal calculator, annual lease/request boundary, category bulk writer, source approval flags, established fee/tax calculations and immutable booked snapshots.
- Fix: lost row identity/unknown metadata on rename; stale quote/save responses; preview incorrectly presenting subtotal as total and active offering as bookability; malformed draft exceptions.
- Extend: explicit reviewable annual base-date fill. Leap-day, cross-year and inclusive-endpoint handling are tested; overlap among other seasons fails visibly. No rates are seeded.
- Still distinct: ordinary units use InventoryCategory base, applicable BAR and PricingRule/config seasons; validated annual grids bypass these. The unit editor now says so before a save.
- Normal ordinary base/BAR fields exist in property onboarding steps 5/6. Unit dated exceptions use AvailabilityPricingPanel. `/app/admin/config` still requires JSON for `pricing.season.calendar`/`pricing.category_rates`; a broader form replacement is deferred to finish the requested unit journey first.
- Per-unit and whole-category save exist. Selected-group/portfolio reviewed copies, shared-rule inheritance and arbitrary booking-policy editing are not implemented by this slice. Do not describe category copy as inheritance.
- Refund ladders still require compatible existing booking policies. This slice preserves/renames existing policy terms; it does not fabricate missing legal/commercial policies.

## Verification

- 13 dependency-free checks executed against the exact candidate TypeScript domain modules: full calendar, cross-year boundaries, leap-day inclusion/exception, shared-endpoint conflict, invalid/no-remaining dates, repeat application, canonical boundary/leap totals, repeated rename/save/reload metadata preservation and malformed-input rejection and colliding saved-row identity rejection.
- Added Vitest domain, client, API and database integration regressions. Existing tariff/canonical suites remain required.
- Local React/Next/Prisma checks not run: workspace contains connector-fetched source artifacts, not an installed application checkout. CI and the isolated browser runner must establish their results on the exact candidate head.
- Actual browser proof, screenshots and remote CI are pending at initial patch creation. No production claim follows from source tests.

Rollback: revert this isolated patch. Existing persisted grids remain engine-compatible explicit date windows and amounts; there is no schema migration or new persisted pricing mode to reverse.
