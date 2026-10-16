# Project amenity content proposals: bounded employee journey

## Outcome and authority

An employee with an active exact-project `content_contributor` assignment can select existing canonical `ProjectAmenity` records or propose new facilities in `/property/content`, save and resume a draft, submit it, and receive an administrator review in `/app/admin/property-content-proposals`. Submission changes only the saved proposal. Approval applies the descriptive changes transactionally and records an audit event.

This extends the existing employee content workflow; it does not widen `staff_ops`, contributor grants, the admin shell, unit inheritance, direct amenity mutation, commercial authority or publication authority. It supports AT28 scope isolation and the amenity portion of AT29 usable/localized content work. Component or source evidence is not end-to-end release acceptance.

## Editable contract

Project proposals may include a sparse `amenities` list. Omitting a facility or using an empty list never removes/replaces any facility. Each entry declares an existing canonical ID or a new draft, an explicit RU/EN/TH/ZH text locale, name, short description, multiline full description, location/floor label, access instructions, access-hours changes, optional independent staff-hours changes and visitor-rule changes.

- Names and descriptions are plain text, rendered as text, not submitted HTML.
- Access instructions are public visitor guidance. The editor and reviewer explicitly warn against door/safe codes, Wi-Fi passwords and other private check-in information. Private unit-access storage remains a separate workflow.
- Existing facility IDs must belong to the assigned project. Duplicate IDs and foreign IDs are rejected. Unit proposals cannot contain facilities.
- Normal hours use time controls, optional IANA timezone and explicit 24-hour controls. No JSON entry is required. An unchanged `24:00` closing time is retained through HTML time controls.
- Access and staff schedules remain separate. Access daily edits merge `daily` and retain custom weekday/split/staff keys. Clearing access removes the access/custom schedule but retains staff contact and its timezone. Staff range/clear changes only staff contact, retaining other schedule data. Staff-only edits expose an optional shared timezone input; omitted timezone preserves existing information, and unknown information is never invented.
- Non-object legacy/custom schedules stay unchanged by default and cannot be silently converted to daily/staff ranges. An explicit access-clear is required before replacing such a schedule.
- Structured rules remain unchanged unless the author explicitly replaces them with bounded plain-text lines.
- No deletion, slug, media, price/fee, pricing type, capacity, minimum age, reservation configuration, booking URL/mode/requirement, auto-confirm, publication, featured state or entitlement fields are accepted.
- Booking requirements and advance-notice configuration remain in the existing authorized operational workflow. Contributors can propose descriptive instructions and rule wording but cannot activate booking or change structured lead time.

An approved new facility is still unpublished. Access and pricing are `not_specified`; booking is `none`/not required, with no native reservation configuration. An authorized administrator must complete the existing publication/commercial setup separately. Existing publication and commercial configuration are preserved.

## Localized review and source protection

The public amenity reader uses deterministic content keys and its existing requested-locale fallback chain. The editor/reviewer use that same chain, including empty-string and `needs_review` behavior. Review shows raw proposed values, effective selected-locale text and changed canonical fallback values. Trimming an automatically filled fallback does not count as a new authored translation. Approval updates only explicitly changed localized fields in the chosen locale, retains every other locale/status and marks changed translations `needs_review`. Preserving other translation rows does not guarantee unchanged rendered text in other languages: their fallback chain can select the changed translation or shared canonical base. The effective-preview notice states this explicitly. Existing translation review/build gates are unchanged. New UI labels include EN/RU/TH/ZH drafts through the existing content seed/fallback system.

All amenity scalar fields and relevant content-key/translation values and revisions participate in the canonical baseline. New, changed and deleted facilities or locale changes invalidate a stale review. Parent/child/content rows are locked in deterministic order. Serializable transactions retry only known rolled-back serialization/deadlock failures; timeouts and unknown outcomes are never automatically retried. Duplicate approvals re-read the committed result and do not reapply changes. Existing amenity timestamps explicitly advance beyond their previous revision for compatibility with the direct editor's CAS token.

Amenity fixed keys have no per-row copy-on-write pointer. Before changing those keys, approval fails closed when current supported persisted key-pointer fields elsewhere in the schema alias them. This is a bounded check, not a global schema-level exclusivity guarantee for arbitrary static, JSON, future or concurrent non-cooperating aliases. Existing unit/project description copy-on-write and marketing-title pointer protection are preserved.

## Compatibility and data effects

Saved version-1 proposals remain readable and approvable with their original baseline semantics and never write amenities. An explicit rebase upgrades a returned/draft proposal to the version-2 facility baseline. Adding facility changes to a legacy baseline without rebasing is rejected. Version-2 proposals use the existing CRM proposal store; no schema migration or live-data backfill is required. Media ownership, exact role checks and all existing unit/project fact restrictions remain intact.

A code rollback to a reader that only understands version 1 will not understand newly saved version-2 proposals. Retain the compatible reader or use a forward fix; do not delete proposal records as a rollback shortcut. Historical reservations, units, financial data and accepted terms are not rewritten.

## Verification and release gates

Local evidence: 379 passing tests across six isolated schema/service and React component suites; strict UI/helper TypeScript; changed-source lint; source review and patch/hash verification. The local fixture harness substitutes Prisma runtime constants and is not a generated-ORM or database check.

Additional real PostgreSQL integration cases are in `content-proposal.integration.test.ts`: concurrent approval idempotency, draft defaults, localized changes with preserved commercial/custom fields, insert/delete/edit locking, persisted pointer aliases, and a concurrent missing content-key insertion that must roll back instead of clobbering.

`scripts/e2e/project-amenity-content.mjs` is the dedicated Chromium acceptance runner. It uses the repository isolation guard, local disposable `myuno_browser_test`, synthetic fixtures, blocked egress and separate evidence/traces. It is integrated after `complex-amenities.mjs` in the existing isolated browser workflow, with `browser-results/project-amenity-content-result.json` included in the artifact list. Do not replace the earlier runner, workflow commands or evidence. The unpublished-facility checks distinguish authentication from eligibility: anonymous booking visits must reach login with the exact return path, while the authenticated reviewer must see the exact “Page not found” heading with no facility or reservation controls. Streamed HTTP 200 is accepted only with that rendered not-found boundary; the reservation API must still return exactly 404.

Not verified locally: generated Prisma-client typecheck, real PostgreSQL integration behavior, full repository suite/production build, Chromium runner execution, Vercel deployment or production runtime. Those are required release gates before claiming this journey is ready. No production mutations, live role/account changes, publication, merge or deployment are part of this candidate.
