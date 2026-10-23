# Canonical pricing desk — local verification, 2026-10-21

Baseline: `5497f1ed` (PR #319), clean worktree before this change. Open PRs inspected: no overlapping pricing/calendar PR. Scope: pricing/restrictions workspace (CO stay quote/booking, AT quote/booking/calendar parity). This evidence is local, not production acceptance.

## Result

`/app/admin/config` now opens a seasonal price matrix with nightly / 30-night views, project/category/unit selectors and explicit single-unit / current-category bulk scope. Calendar is a 14-day, horizontally scrollable, clickable projection of canonical Booking/BlockedDate occupancy and `computeCanonicalCalendarRates` prices. One click selects a night; a second selects the inclusive final night. API writes convert to an exclusive end date.

The full canonical calendar links back to this workspace with the inspected unit/date; the workspace opens the same filtered full calendar. Existing advanced seasonal settings and legacy project configuration are retained under disclosure.

A matrix cell PATCH changes only the chosen daily/monthly season's amount. Each target's other rates, annual windows, inclusions, booking policies and approvals are retained. Missing target seasons abort the whole category transaction. Category scope is an explicit bulk operation on current units, not an inheritance promise for future units.

Dated writes use existing `PricingRule` rows and the existing `createPricingRule` validation, with sorted unit/category locks, current active admin checks, expected revision and transactional audit. Overlapping individual rules abort the entire batch. User-entered amounts are baht; core values remain integer satang. Grid nightly quotes use explicit dated overrides before fees/tax calculation; source approval and policy minimums remain enforced. Monthly and annual contract pricing do not inherit daily date overrides. Accepted Booking rows/snapshots are never updated.

## Compatibility / migration

Preserve: seasonal tariff grid, monthly/yearly terms, source policy/tax approvals, bookings, blocks, previous configuration editor and delegated employee editor.

Extend: matrix cell writer, dated calendar writer, both backed by canonical writers/readers.

Fix: calendar projection may display a daily rate even when the viewport is shorter than the seasonal minimum; actual booking still enforces the minimum.

Migration: `20261021150000_pricing_rule_tariff_grid_intent` adds `PricingRule.appliesToTariffGrid NOT NULL DEFAULT false`. Existing dormant legacy rules MUST remain inactive on validated grids. Only explicit new admin calendar writes opt in. No existing prices, bookings, policies or approvals are migrated/activated.

Apply this additive migration before deploying code that reads the column, through the normal protected migration/backup/allowlist process. It has been applied only to two fresh isolated local PostgreSQL databases. Production migration state and production data have NOT been inspected or changed. Rollback: revert application code; retain the additive column and audit rows. A newly created dated rule can be removed through the existing unit calendar action after reviewing its scope. Do not drop the column while this application version runs.

## Verification

- 155 tests in 17 files passed, including 13 new dated/matrix service cases, API authority/replay cases, category rollback, concurrent saves, dormant legacy-rule compatibility, tariff editing, source/legacy pricing, annual leases, booking category allocation and canonical calendar regression suites.
- `npx tsc --project tsconfig.production.json --noEmit --pretty false`: passed.
- ESLint for all changed TypeScript/TSX files, `--max-warnings 0`: passed.
- `git diff --check`: passed.
- Chromium, real local Next.js + PostgreSQL: matrix category save, preservation of monthly prices, date-range category save, exact canonical-board source/price parity, and return unit/date context passed. 0 uncaught browser JavaScript errors. No document overflow at 390px. Primary date apply action visible in the initial 1440×1024 desktop viewport.
- [Matrix](matrix.png), [calendar with selection](calendar.png), [mobile calendar/form](mobile.png). These contain explicitly local demonstration data, not production inventory.
- Next development overlay reports the existing shared `getRequestLocale` synchronous `cookies()` compatibility warning from `src/lib/i18n.ts`, invoked by the unchanged root layout. It is not a pricing runtime exception; no application change was made to hide it.
- Full `npm run build` after integration with `d9f9673f`: passed using the existing explicit isolated CI mode, with equal DATABASE_URL/DATABASE_URL_TEST pointing to the local test database. This exercises the production compiler, lint/type validation and 84 static pages. Real production content-review/deploy/runtime acceptance remains unverified; no production gate was relaxed.
- General `tsc` includes existing test/doc-fixture errors outside this task; production tsconfig is the repository's configured build check and passed.

## Remaining rollout work

Protected migration/release review, content registry deployment and translation review (`needs_review` RU/EN drafts are registered, no content was automatically approved), production build, deployment and production runtime acceptance. No external notifications were sent, no PR was created and no production data was written.
