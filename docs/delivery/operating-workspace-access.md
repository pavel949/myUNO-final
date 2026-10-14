# Explicit workspace setup and scoped operations

Baseline: `2546a844d69f8debb7492f5c2d0386cce5dd55d7`.

## Workflow and scope

`People & Roles → Workspace scope & member access → organization → exact homes → member capabilities → Tasks`.

The founder uses existing canonical organizations, units and people. An eligible unit must have a current verified operating project relationship with that organization or an active evidenced management-company engagement. No ownership, mandate, global role, department policy or member is inferred or created automatically.

A founder first gives the person the appropriate existing project staff role and departments in People & Roles (or verifies the management-company mandate). The workspace editor then grants explicit capabilities only when at least one currently attached unit is also authorized by those independent rights. New grants are limited to manage_tasks, assign_tasks, manage_housekeeping and manage_maintenance. Existing active capabilities may be retained when their independent authority still exists, or explicitly removed; they are never silently revoked. Unavailable capabilities remain visible in the editor. This delivers the manual daily-task path only, not full reservation or finance delegation.

No default organization, all-units selection or all-capabilities selection. No real production setup is performed by this code change. Empty setup is an explicit state.

## Security boundaries

- Every governance command re-reads active founder identity from the database.
- Scope changes use the observed workspace `updatedAt` version; stale writes return 409.
- Cross-organization current or future attachment overlap is rejected under sorted per-unit advisory locks. Same-organization grouping does not create another occupancy authority.
- Removed attachments and deactivated memberships remain records; before/after audits are committed atomically. Reactivation records a new effective period in the audit while reusing the schema's unique attachment row.
- Scoped task reads/writes intersect active identity, active organization/space, membership capability, effective attachment, current verified organization relationship, and existing project department or organization-matched management mandate. Known IDs and stale session flags do not bypass this boundary.
- Null-space historical tasks retain canonical legacy unit/project authorization. An explicitly supplied invalid space does not fall back to that path.
- Creating/assigning a scoped task verifies the named recipient and every active member of an assigned team can operate that exact unit. Task state transitions remain canonical.
- Housekeeping/maintenance views and preventive-plan reads use their own capability. New recurring-plan creation is explicitly unavailable (HTTP 409, no UI form) until the existing scheduler enforces current scope and valid assignments. Existing schedules are not modified or certified safe by this patch.

- Workspace chooser and home use the same effective-unit resolver, including count-only cards. Task-only members see no booking counts or roster totals. Revoked project authority removes existing-cookie access.
- The reservation desk requires effective manage_reservations scope before reading guests, groups or bookings; non-founder guest choices are unit-linked and mixed/out-of-scope groups are excluded. This does not enable new reservation delegation.
- Task form and queue receive the selected workspace timezone, preserving PR #259. Explicit MC mode remains intersected with current management-company authority.

## Preserved and deliberately limited

No schema migration, production mutation, deployment, payment collection, ledger mutation, owner-statement change or public claim is included. This patch does not complete the broader legacy PRs #194/#231.

The task/manual-booking async-reset and task-timezone repairs are already present in the new main baseline through #259. This patch does not overwrite those form/helper files. The deferred preventive form is not exercised. An operational task's `blocksInventory` flag still does not itself create a canonical availability block; this remains a separate readiness blocker. Task photos, all operational localization and production role/data configuration need runtime evidence.

## Verification

Authored coverage: 178 PostgreSQL/HTTP/SSR integration cases, 6 component cases and 2 updated existing task-service unit cases, including the original 107 integration cases. These counts describe authored tests, not executed results. No database, Vitest, build or browser run has executed this v3.1 artifact locally. Node 24 executed the exact candidate with synthetic ORM doubles: stale transition rejection, seven invalid amount cases, cross-uploader denial, private PDF metadata preservation and exact-unit founder reuse predicates passed; this is not PostgreSQL evidence. Non-JSX TypeScript syntax transformation passed; TSX remains unparsed locally. Syntax-only checks are not TypeScript semantic checks, browser verification, database-test execution or deployment evidence. Exact-head CI and independent security review must pass before merging. The isolated browser fixture must include the verified synthetic organization relationship before exercising these new guards.

Revert the application patch to roll back code; it does not need a schema rollback. Any separately authorized future real setup should be reversed through audited scope/member deactivation, never by deleting history.

## Integration and remaining release gates

The parent must review this exact v3.1 diff before staging/merging; the first independent review identified the v1 count and recurring-generator gaps; a subsequent independent v3 review identified the new-task missing-space bypass. Exact v3.1 approval is still pending. Publication was paused after an uncertain v1 Git blob approval; v2 staging was cancelled at the reservation-page blob, with 17 immutable blobs recorded and no tree, commit, ref or PR. v3 remains local-only pending renewed specific staging direction.

PR #261 independently changes the reservation desk's outstanding-balance import/aggregate. Apply this authorization patch without reverting those two finance-helper changes if #261 merges first. Current baseline already includes #259 and #260.

Production read-only inspection on 2026-10-14 found zero active workspaces. Actual organization/unit mapping, explicit staff membership and business testing remain separately authorized setup work. Full staff booking/finance delegation, existing recurring schedules, inventory blocking and photo/localization checks remain outside this manual-task launch slice.

## Confirmed daily-task integrity corrections (v3)

The original service accepted any known MediaAsset ID and returned full storage metadata. The original transition read and update were not compare-and-set; a forced interleaving could write blocked after ready while retaining completedAt. Both were reproduced against the exact service with synthetic ORM doubles before correction.

Task attachments now require a fresh active actor with current task-unit scope. Staff may attach their own photo/document/receipt records. A founder may additionally reuse another uploader's asset only if already linked to the exact canonical task unit through UnitMedia or an OperationalTask with the matching project. Missing, expired, unrelated, passport/avatar/brand and unsupported-MIME assets fail closed. No asset is published, decrypted, copied or reclassified. The create response includes only ID/kind/MIME/size/encrypted metadata, without storageKey, uploader ID or private URL.

The existing task upload UI supports JPEG/PNG/WebP. The service preserves owned existing PDF and MP4/WebM document attachments and private metadata; it does not add a PDF/video upload or private-download interface. Private ExpenseReceipt records remain in their separate unit/ledger authorization flow. Existing image/video MIME predicates are reused; the public-gallery access guard is not repurposed for private evidence.

Task transitions compare the current status and updatedAt, advance the version monotonically and change state/timestamps/assignment atomically. A stale concurrent writer receives conflict and must reload. No inventory mutation is added: blocksInventory remains the pre-existing flag. Cost values must be finite nonnegative integer satang within the canonical PostgreSQL Int32 range; malformed HTTP THB values are rejected before conversion.

The PostgreSQL regression suite includes a forced concurrent ready/blocked interleaving, cross-uploader and cross-unit negative cases, founder revocation and safe private metadata assertions. Those database tests still need exact-head CI.


### Explicit creation context (v3.1)

Independent review found that omitting operatingSpaceId on the new manual-task POST could fall back to project-wide legacy rights. Non-founder manual creation now requires an explicit workspace from a fresh transaction identity, including when a stale session/body claims admin. A same-project unattached sibling is denied. Founder creation and existing historical null-space read/PATCH remain authorized by their canonical unit/project and independent legacy role; a workspace revocation does not itself revoke those separate legacy rights. Six additional HTTP regressions cover these distinctions.
