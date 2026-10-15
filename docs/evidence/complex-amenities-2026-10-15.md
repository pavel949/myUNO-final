# Complex amenities: editor and public usage facts

Requirement: owner-requested complex-level facilities, descriptions, location/floor, hours, booking notice and visitor rules; readable from the complex and linked units. Relevant acceptance: AT16 (reuse a project), AT28 (scoped access), AT29 (usable forms and locale copy).

## Reconciliation and outcome

- Preserve `ProjectAmenity`, Project Experience authoring, media, translations and project-scoped authorization. No new model, migration, facility array, Unit amenity copy, role, grant or pricing writer.
- Extend ordinary editing with selectable common facility names, daily time inputs, a separate 24-hour access checkbox, separate staff-contact hours, project timezone, visitor-rule lines and booking notice in days/hours/minutes.
- Preserve custom weekly/split schedules through the existing custom format; preserve unknown reservation-config fields. Invalid JSON is rejected rather than silently stored as broken text.
- Default missing fee/access information to `not_specified`. A booking requirement without a specified method becomes `other`, which does not enable native reservations. Existing explicit fee/access/method values remain unchanged.
- Display location and daily hours on existing amenity cards, human-readable schedules and booking lead time on detail, and a separate shared-complex section on already-public unit pages.
- Fix descriptive amenity list/detail visibility to match the canonical complex portal's existing managed-import draft exception. Missing/unmapped drafts and archived projects remain hidden. Native booking pages/actions and the canonical reservation writer enforce the live-project gate, including direct API or privileged calls.
- Add versioned compare-and-swap PATCH writes. The version advances monotonically even within the same clock millisecond. A stale or racing edit returns 409, a missing version 428. The client keeps user input, locks fields during save, prevents repeated submissions, and distinguishes a saved write from a failed list refresh.

## Owner-supplied content

The Title Legendary was resolved by exact project ID, slug and name before mutation. The authorized 2026-10-15 guide enriched six existing rows and added eight missing facilities. The existing clubhouse/security rows, IDs, names, photos, fees and project status were preserved. The complex has six linked units. Reception 24-hour access and staff contact 09:00–18:00 remain distinct; no pool floor, fee or reservation contact was invented. Required notice is stored as 1440 minutes with method `other`; native booking was not enabled. Existing onsen/sauna concepts are represented without duplicating the existing sauna. A transactional audit records before/after and the supplied source. SQL writes used exact preimage comparison and refused concurrent changes. No schema, migration history, unit amenities or role data changed.

The saved opening-hour strings remain readable by the previous deployed detail renderer; the new editor also understands this compatibility form. Content persistence is verified, but this does not establish that the new UI has been deployed.

## Verification and limits

Focused isolated harness: 46 tests across pure schedule/lead-time logic, service defaults, project visibility, admin form interactions, shared-unit rendering and the scoped/concurrent PATCH route. Strict TypeScript passed for changed client components/helpers. Focused ESLint uses the repository configuration and local UI-text rule. Exact base/new Git blob hashes and the patch are checked separately before publication.

These checks use mocked DB/auth dependencies and are not a full application, authorization integration or PostgreSQL concurrency pass. Full repository CI, generated Prisma typecheck/build, disposable PostgreSQL integration, deployed desktop/mobile/keyboard/localization acceptance and production runtime validation remain release gates. New public EN/RU/TH/ZH copy uses CMS-first locale drafts; content/localization review is still required. Existing admin authoring copy remains English.

## Rollout and recovery

No migration is required. Review this draft, run the full checks above and verify published/draft/archived cases plus a real stale-edit conflict before a separately authorized deployment. Old open editor tabs must reload to obtain an edit version. Code rollback leaves compatible canonical records. Content rollback must compare the recorded after-image before restoring any touched field; never delete newer edits or the pre-existing facilities. No automatic rollback SQL is shipped.

## PR #289 acceptance repair

Baseline head: `78439150ac94f3e10197f3ce998162090dc6b526`; failed isolated run: https://github.com/pavel949/myUNO-final/actions/runs/38746427904, job `116461172325`. The step-12 screenshot shows the login screen, not a reservation form. The anonymous booking-page request called `getCurrentUser` and redirected to login before checking public project/amenity eligibility; Chromium followed it and received HTTP 200. This is an authentication-order/route-contract defect, not evidence of a created draft reservation. The canonical writer already rejects non-live projects even for privileged callers.

The page now validates public eligibility, live status and native booking mode before authentication. Eligible live resources retain login and the encoded return path. The API/writer restrictions, roles, pricing and existing facility data are unchanged. Next.js may stream status 200 through the existing loading boundary before resolving `notFound()`: browser assertions therefore require the final exact not-found heading at the original path and absence of the Reserve button; neither an HTTP status alone nor a login page counts as success.

Added eight page-level regression cases. Local verification: 54 tests in nine focused files, strict production TypeScript, changed-file ESLint and JavaScript syntax/diff checks passed. The isolated suite additionally checks anonymous/admin draft and archived booking pages, privileged POST 404 with zero target reservations, plus a distinct live 201 control and live login/form reachability. It edits and saves at 320/390/430px, retaining 390px public complex/unit read-through. A canonical local synthetic cover prevents the staff-shell redirect to the homepage from requesting external illustrative imagery; isolation guards and zero-egress/zero-server-error assertions stay enabled. Existing missing-media unit behavior remains covered.

All acceptance writes are restricted to `myuno_browser_test` on localhost. No production database connection, The Title Legendary write, real booking or tariff mutation is used in this repair. Full CI/browser workflow outcomes must be read from the final PR head before merge. The Vercel production alias was inspected during this work and still served `408ad99abfae9e7e67b6f518a736b751d72a7283`; it is not evidence that this PR is deployed. Git auto-deployment is disabled in the repository.
