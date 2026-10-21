# Property-card editing regression verification — 2026-10-21

Repository: `pavel949/myUNO-final`. Base: `cb8e00c4a82e5a454f1e21b074695ee190b43e52`, including PMS PR #316. This report describes synthetic local verification, not production state.

## Resulting behavior

- `/ops/projects/:id/edit` saves canonical descriptive facts without submitting the forbidden legacy `facilities` array. Shared amenities remain in Project Experience.
- Canonical unit create/update writers reject blank names/location supplements, invalid counts and invalid/negative areas. Nullable areas remain nullable; fractional measurements are accepted only by decimal area fields. Existing gross, usable, outdoor, plot and legacy area meanings remain separate.
- PMS unit/project edits include the loaded `updatedAt`. Atomic conditional updates return 409 for stale versions without overwriting another editor. Successful edits advance the version; failed edits remain in the form, and conflicts offer an explicit reload. Other existing command clients remain compatible when no version is supplied.
- Gross area is directly editable and labelled as the listing headline; legacy size is explicitly labelled as a fallback. Search/detail headline selection keeps this distinction without copying values between fields.
- Sleeping-space create uses the existing idempotent canonical writer. Update/delete constrain both unit and room IDs and the loaded room version. Nested bed replacement is atomic. The existing administrator-only API guard is unchanged; no new staff/MC/owner authority, room inference, capacity change or publication authority is introduced.
- Unit/project/gallery/sleeping controls use registered EN/RU/TH/ZH drafts and CMS overrides. CMS review status is not changed by runtime fallbacks.
- Back links use permitted same-unit return paths. Dirty forms warn on native unload/in-app links; browsers with the Navigation API also guard back/forward traversal. Unsupported same-document traversal implementations remain a browser-coverage limitation.
- Submit locks use synchronous refs. Distinct development upload URLs retain separate asset/uploader ownership even for identical bytes. Blob still uses its existing random suffix contract. Partial gallery failures always attempt canonical refresh and advise retrying only missing photos; refresh failure requests reload before retry.

## Reproducible verification

All mutations used a task-owned PostgreSQL 16 container bound to loopback. Browser data: `myuno_browser_test`. Aggregate tests: `myuno_test`. No external storage credentials; server/browser egress guards prevent hosted writes.

```sh
# Use explicit disposable loopback DATABASE_URL/DATABASE_URL_TEST; never a hosted DB.
npx prisma migrate deploy
npx prisma generate
npx vitest run src/modules/projects/property-editing.integration.test.ts src/components/property/property-editing.test.tsx src/lib/property-area.test.ts src/lib/property-editor-return.test.ts
npm test
npm run lint
npx tsc --noEmit --project tsconfig.production.json
npm run build
node --test scripts/e2e/isolation.test.cjs scripts/e2e/block-egress.test.cjs scripts/e2e/workspace-navigation.test.cjs
npm run audit:inventory:test
```

The focused editing suite passes 35 tests across four files. The development browser runner passed all ten scenarios: login form; project save/reload; physical facts and distinct areas/public render; invalid API facts; stale editor; cancelled navigation; sleeping create/update/delete and staff denial; identical PNG upload/cover/reorder/delete/public cover; desktop/mobile layout; Russian labels.

Browser runner: `scripts/e2e/property-card-editing.mjs`, using the exact environment in `scripts/e2e/isolation.cjs`. Seed with `scripts/e2e/seed-founder-journey.ts`. It preserves screenshots and structured results under `browser-results/property-editing/` and restores only its synthetic fixture. CI invokes it after the existing founder journey and uploads its evidence. `CHROMIUM_EXECUTABLE_PATH` optionally selects an installed browser. `PROPERTY_EDITING_SERVER_MODE=development` enables the real data-URI duplicate-file scenario; the production-server path instead checks fail-closed upload recovery with no durable-storage credentials.

An initial aggregate attempt used a safe but differently named disposable database (`myuno_property_test`); two suites deliberately refused that name. It was stopped and rerun against their allowlisted `myuno_test` in the same container. No guard was bypassed.

## Remaining limits

No production Vercel inspection, deployment, Blob upload, real-property mutation, migration/schema change or legal/commercial attestation. Actual Blob provider behavior, external map tiles/geocoding, exhaustive locale quality and non-Chromium traversal behavior remain unverified. White fixture photographs are synthetic PNGs, not evidence of missing real photography. Final aggregate status is available on PR #317 checks.

## Validation checkpoint

Lint, production TypeScript, production build, repository reference/documentation checks and isolated safety/policy guards passed locally. The local production-server runner also passed all ten scenarios, including fail-closed storage recovery and real browser back cancellation, with no browser runtime errors. The development run separately exercised real identical-file uploads, cover selection, reorder and delete.

The first complete aggregate run passed 6,140 tests with one obsolete source-name parity assertion; that assertion now recognizes the extracted return-target helper. Its corrected complete rerun passed 572 files and 6,147 tests. A final pending-save edit race regression was then added and fixed: newer text remains dirty when an earlier request commits. The focused run now passes 45 tests (35 editing/area/scope regressions plus ten existing design parity checks). The complete suite was rerun after this correction. See [PR #317](https://github.com/pavel949/myUNO-final/pull/317) for final aggregate and CI results. Local screenshots and raw logs are retained at `/workspace/property-fix-20261021` in the task environment, not uploaded to Library.
