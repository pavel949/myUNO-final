# Copy existing unit photos to the complex gallery — 2026-10-12

> **Исторический отчёт / evidence прежнего среза.** Не является текущим статусом main или production. Актуальное [описание системы](../current/SYSTEM.md) и [реализация / остаток](../current/IMPLEMENTATION_STATUS.md) сверены 2026-10-16. Команды и результаты ниже относятся только к исходному контексту отчёта.

Scope: CO24 content/media lifecycle and AT16 scoped gallery authoring.
Initial baseline: main `fc1376f12402baad0856275a5f9d4fc1bf3df998`.
Final branch rebased onto `31a09e96fa8b0eb376abd01bcf50893aa47b3d99` (PR #249,
booking DTO changes only), with the separate public-cover commit preceding this patch.

## Existing capability and gap

Canonical project media POST already links an existing public MediaAsset by ID
using an idempotent ProjectMedia upsert. Unit media DELETE only unlinks the source
association; it does not delete the original asset. The editor previously exposed
only new uploads, leaving no supported UI to reuse an existing unit photo.

## Minimal UI workflow

In the exact-unit gallery only, each photo has **Copy to complex gallery**. It:
1. POSTs the existing media ID to this same parent project's canonical media endpoint.
2. Reads that project gallery back with no-store and requires the exact media ID.
3. Reports confirmation and disables the repeated copy button for that photo.
4. Leaves the original unit link intact; the existing Remove action is separate.

No arbitrary destination picker, new move API, bulk action, file upload, asset
delete or schema change. Project/unit authorization remains in existing handlers.
A synchronous operation lock prevents duplicate clicks; source removal and scope
selectors are disabled while a copy is pending. A denied or unconfirmed copy gives
an error and is retryable. Retrying reuses the same MediaAsset/ProjectMedia key.
Gallery loads are request- and target-bound: stale responses cannot expose another
unit's photos as copy targets. Confirmation state resets on gallery switches, so
removing a project association does not leave a falsely disabled copy button.
Different media IDs may still contain identical pixels; this operation does not
claim pixel-level deduplication and callers should review existing complex photos.

## Copy and localization

New copy is registered in GALLERY_EDITOR_KEYS as needs_review drafts. Both existing
editor routes pass canonical getLabels locale drafts for EN/RU/TH/ZH. No CMS rows
or review status were written. Reviewed CMS translations retain precedence.

## Verification

- Component cases cover destination read-back before success, duplicate clicks,
  same-ID retry after missing/denied/network read-back, 403 rejection, no source
  unlink/upload, source controls locked during copy, project/category exclusion,
  photo-only action, stale success/failure responses, copy/project unlink/recopy,
  failed return-to-scope and post-copy source reloads, and complete registered locale drafts.
- Combined regressions: 10 files / 104 tests passed. Full repository ESLint and
  production TypeScript passed. `git diff --check` passed. No full database suite
  is claimed.
- Final production compilation (`next build`) passed with database variables
  unset; the database-backed content review gate/runtime were not exercised.
- Local Chromium visual QA was attempted but blocked by host socket EPERM, also
  on a permitted elevated launch. Synthetic fixture artifacts are available;
  no screenshots or successful visual verification are claimed.
- Deployment, authenticated destination/source read-back and actual-photo browser
  verification remain release-time checks. No production data was changed here.

## Release and recovery

Review and ship on current main. Confirm the new button on both admin editor
routes. For a reviewed common-area photograph: copy, verify confirmation and
project appearance, then separately remove the source unit association. Preserve
an appropriate exact-unit cover and readiness minimum. Repeated copying of the
same media ID must not increase destination count. If verification fails, retain
the source and retry the idempotent copy. Code rollback removes the UI only; both
original files and existing associations remain unchanged.
