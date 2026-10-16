# Public gallery cover presentation — 2026-10-12

> **Исторический отчёт / evidence прежнего среза.** Не является текущим статусом main или production. Актуальное [описание системы](../current/SYSTEM.md) и [реализация / остаток](../current/IMPLEMENTATION_STATUS.md) сверены 2026-10-16. Команды и результаты ниже относятся только к исходному контексту отчёта.

Scope: CO24 content/media lifecycle; AT16 gallery configuration and AT29 public desktop/mobile presentation.

## Finding and reconciliation

Baseline main: `fc1376f12402baad0856275a5f9d4fc1bf3df998` (PR #248).
The admin editor saves `coverMediaId` independently from gallery sort order. Public
readiness resolved the cover correctly, but returned photo URLs in raw gallery
order. Inquiry-only unit and project mosaics treat URL zero as the hero, so a
successfully saved cover later in the gallery did not become the hero.

Preserve: canonical media IDs, source files, gallery associations/sort values,
readiness/publication gates, exact-unit versus representative-room scope, video
ordering, permissions, pricing and booking eligibility.
Fix: the shared public readiness projection emits a valid selected cover once at
position zero, retaining the relative order of every other photo. Unavailable
covers keep the prior photo order and remain blocked by existing readiness checks.

No data migration, schema change, dependency change or new API. No production data
was changed for this code fix. Existing priced-unit API already applies cover-first
presentation; repeating its filter remains harmless.

## Local evidence

- Red baseline: new readiness regressions produced 4 failures, 7 passes before the fix.
- Green focused regressions: 9 files / 87 tests passed, including shared readiness,
  inquiry-only projection, project/category/live-unit projections, gallery policy,
  publication/price gates, gallery editor, desktop mosaic and mobile carousel.
- Production TypeScript: `tsc --noEmit -p tsconfig.production.json` passed.
- Whole-repository ESLint: `eslint . --max-warnings 0` passed.
- `git diff --check` passed.
- Production compilation: `next build` passed with database environment variables unset.
  The database content-review gate and database-backed runtime were not exercised.
- Full database-backed suite: not run for this isolated read-projection patch.
- Deployment and real production image verification: not performed; release review required.

## Release and rollback

Ship only the reviewed patch on current main; no database operations are required.
After deployment, reload an exact-unit inquiry page with its cover not first in
stored order and confirm desktop hero and mobile slide one use that cover. Verify
the project gallery independently and confirm image counts remain unchanged.
Rollback is a code revert; stored order, cover and original assets remain intact.
