# Protected owner and workspace administration — local review candidate

Initially prepared from `origin/main` **a0f19fe4** (includes #320 and #321),
then integrated with **24e3b805** including the reviewed reservation importer. Code publication is authorized. No production deployment, migration, invitation,
password operation or account assignment is included.
The designated release coordinator retains release ownership.

## Authority model

`Identity.isSuperAdmin` is a protected **singleton owner**, not a grantable tier
for several people. The eventual approved binding is Pavel's verified identity ID.
Email is a lookup/verification attribute, never the authorization mechanism.

* A partial unique index on the constant `1`, filtered by `is_super_admin`,
  enforces at most one owner across all identities and statuses, including races.
* A check requires that owner to be an active platform administrator.
* A deferred constraint trigger prevents demotion/deletion leaving no active owner.
  Account-management services take one transaction advisory lock and make that
  constraint immediate, so failures surface before the service returns.
* The owner cannot self-disable, self-demote or request self-deletion. Other
  administrators cannot edit/disable the protected identity. Ordinary HTTP APIs
  cannot appoint a replacement or a second owner.
* `OperatingSpaceMember.isAdministrator` is independent of `Identity.isAdmin`.
  Only the singleton owner can appoint/revoke a workspace administrator.
  Appointees must be active password accounts without global administrator flags.

Legacy `isAdmin` identities retain their previous global rights during transition;
none becomes the protected owner automatically. This is compatibility, **not** a
claim that legacy administrators are workspace-scoped. Their inventory must be
reviewed before rollout; removals require separate exact-account approval.

## Capability matrix

| Action | Sole superadmin (Pavel) | Layantara administrator (Reya proposal) |
|---|---|---|
| Global control plane/configuration | Existing platform authority | Denied |
| Edit global profile (name/language), globally disable/restore another account | Allowed, audited; self-disable denied | Denied |
| Edit/disable protected owner | Other actors denied; owner cannot disable self | Denied |
| Appoint another superadmin or transfer ownership through HTTP | Denied | Denied |
| Appoint/revoke workspace administrators | Allowed, audited, exact membership/version | Denied |
| View calendar and reservations; operate stays | Existing authority | Exact eligible attached physical units only |
| Booking-level receipt/operating authority | Existing authority | Exact authorized unit through existing stay-operation guards |
| Tasks, task assignment, housekeeping, maintenance | Existing authority | Selected workspace and eligible units only |
| Existing member roster/local display name/local disable/restore | Allowed | Ordinary members in Layantara only; cannot manage global/workspace administrators |
| User's profile/access in another workspace | Existing authority | Denied; local disable leaves global account and other memberships unchanged |
| New global account invitation | Existing platform invitation flow | Denied by global guard; no new scoped invitation writer added |
| Generic/global role grant and property-capability delegation | Existing separately guarded authority | Denied by local-admin appointment alone |
| Tariff/booking-mode editors, publishing, owner statements, global finance ledger, channel configuration, property creation | Existing independent guards | **Not implicitly granted**; separate exact capability/authority review required |

The workspace resolver recognizes non-creation operating capability names, but
these are not a substitute for downstream writers' separate authorization. In
particular `view_finance` in a workspace projection does not open `/app/admin/ledger`,
and a calendar's pricing link does not grant the canonical tariff editor. This
change does not claim complete local finance, channel or publishing administration.

Workspace access uses current active identity + active administrator membership +
active workspace/organization + currently effective attachments + existing verified
organization authority. It never creates a project-wide staff assignment to get
around a failed screen guard. Booking helpers check the real project/unit pair;
the generic permission resolver's local override has a small explicit unit-action
allowlist and no project/platform fallback.

Independent review found that existing booking/guest/calendar readers associate data
with physical units, which is insufficient when workspaces overlap. The new role now
uses one canonical fail-closed isolation filter in both the scoped resolver and direct
booking/receipt authority helper. A unit is omitted entirely if another active workspace
currently attaches it, or if any booking on it has a non-null foreign workspace
reservation-group binding (including history pending reviewed reconciliation).
The same exclusion covers imported group placements that do not create Booking rows;
this boundary was added while integrating the reviewed importer from current main. No
foreign occupancy is silently hidden while displaying the unit as available. Future
attachments do not take effect early; expired attachments do not continue to block.
This role therefore does **not** support ambiguous/shared inventory yet.

Appointment also rejects existing active work roles or another active workspace
membership. Those independent grants must be explicitly reviewed/reconciled first;
the service never silently revokes or reinterprets them. Revocation has no activation,
password or no-global prerequisite: the owner can clear a local administrator marker
after globally blocking that person, without temporarily restoring their login.

## Surfaces and audit

* Global profile editor: `/app/admin/people/[identityId]`, linked from People.
* Local member management: `/ops/spaces/[spaceId]/administration`, linked from the
  workspace Team card for the owner/local administrator. Lists are bounded to 100.
* Mutation APIs reject extra fields, use optimistic membership/profile versions,
  read current authority, and commit changes and audit together.
* Global block/unblock invalidates session generation; old cookies remain invalid
  after restoration. Blocked identities cannot log in or resolve a session.
* Public management responses use explicit allowlists; no password hashes,
  one-time tokens or session secrets are returned. Local lists omit email addresses.
* Local UI copy has registered EN/RU drafts. TH/ZH review remains outstanding.

## isAdmin bypass audit

`administration-isadmin-inventory.txt` records the production-source occurrences
examined (including unchanged legacy seeds). The design preserves the global flag:

1. `getSessionUser`, `getOperationalActor`, `can`, `requireAdmin`, `requireAdminPage`,
   project/booking/order/ticket/media guards and property-capability readers retain
   real `Identity.isAdmin`, never `isAdmin || membership.isAdministrator`.
2. The workspace resolver returns `isAdmin: false` for a local administrator;
   `isWorkspaceAdministrator` is a separate field. This is necessary because guest,
   private attachment and global-finance readers use `isAdmin` to bypass scope.
3. Local member writes never touch Identity privilege/status/password/email fields
   or `RoleAssignment`. Generic role services now reject non-platform actors.
4. Existing role and capability grant/revoke paths protect the owner identity.
   Legacy project-team routes cannot alter the owner's account via those paths.
5. Scope/organization eligibility and current membership are rechecked on reads and
   commands; local revocation does not depend on an old session role snapshot.

This is source review plus targeted runtime tests in isolated PostgreSQL, not a
production-wide penetration test or a claim of complete endpoint verification.

## Migration, bootstrap and recovery — all pending separate approval

Migration `20261021190000_protected_workspace_administration` adds columns,
constraints, singleton index and loss-protection trigger. Defaults are false; it
does **not** select an email, create an identity or elevate an existing administrator.
Fresh migration replay was exercised only in a disposable local PostgreSQL 16 container.

Required rollout sequence for the release coordinator:

1. Independently review this security-sensitive diff and evidence; obtain production
   backup/recovery evidence and migration approval. Do not change the unrelated
   Actions `DATABASE_URL` blocker as part of this task.
2. Verify actual production identity IDs, active state, password-configured boolean,
   verified-email boolean, existing global grants and workspace/organization/unit
   authority using safe DTOs. Never print hashes or credentials.
3. Apply the additive schema before the compatible application. No automatic
   privilege backfill. The initial zero-owner interval preserves existing access,
   but new workspace-admin appointments remain unavailable until explicit bootstrap.
4. Obtain an action-time confirmation naming Pavel's exact verified account ID.
   In a reviewed operator transaction, lock administration, assert zero existing
   owners and the approved account's expected version/contact/active/password and
   mailbox-verification state, assign both global flags, rotate session generation,
   and write an audit record. Validate constraints before COMMIT and independently
   reread the singleton binding afterward. No such transaction was executed here.
5. Separately approve invitation if Reya has no account. Recipient chooses her own
   password through `/auth/claim?token=…`; no administrator-generated password.
   Invitation reuses the canonical account by normalized email and never downgrades
   an active account. Confirm actual email delivery and successful password login.
6. Once the exact active password account ID is known, obtain the separate membership
   confirmation below. Perform negative cross-workspace tests with that account,
   including direct API URLs, before declaring handoff complete.

Recovery is not a route exposed to ordinary admins. A separately approved operator
procedure must prove Pavel's identity and bind an explicitly verified replacement
account belonging to the **same sole owner** if recovery needs a new account. Use
an operator SQL session with error-on-failure and the advisory lock, explicitly
defer the owner-loss constraint, demote the old binding first (to satisfy the unique
index), bind the verified replacement in the same transaction, rotate both session
generations, record previous/new IDs and recovery provenance in the audit, set
constraints immediate, and COMMIT. Verify exactly one active owner afterward.
Any incomplete transfer rolls back. Do not infer a successful deferred COMMIT solely
from an ORM callback resolving; constraint validation and an independent reread are
part of recovery verification. No recovery script or automatic recovery account is
installed by this change.

Rollback: leave additive schema in place if reverting application. After bootstrap,
the trigger will continue protecting the owner from old status-changing writers;
restoring older code does not add scoped-administrator authorization. Do not drop
the owner protections or erase assignments as an automatic rollback operation.

## Account assignment remains outside this code release

The owner and proposed workspace administrator must be matched to exact verified
identities in a separate approved operational process. Personal email addresses,
identity IDs and private confirmation evidence are intentionally excluded from
published source. No seed, migration or default binds a real account.

The intended owner is the sole protected superadministrator. The recipient receives
only the selected workspace administrator membership, with both global flags false.
For a new membership the reviewed API payload is `{ enabled: true,
expectedUpdatedAt: null }`, addressed to the freshly verified identity and workspace
IDs. Existing memberships require their freshly read `updatedAt` value. Invitation,
recipient claim, bootstrap and role assignment each remain separately authorized
operations; this PR is not authorization for them.

## Verification checkpoint

See the final task response for the completed test run and local commit. Supporting
local logs are `/tmp/myuno-security-final-migration.log`,
`/tmp/myuno-security-verification.log`, `/tmp/myuno-security-eslint.log`, and
`/tmp/myuno-security-source-tsc.log`. They contain isolated test evidence only.
Whole-repository `tsc` includes existing historical-document/test typing failures;
production-source type checking is tracked separately. Production verification remains pending release review and action-time approval.
Synthetic local browser verification is recorded below.

Recorded checkpoint: fresh replay of all 97 migrations passed in a disposable local
PostgreSQL 16 database. The focused regression run passed **1085 tests / 24 files**,
including singleton uniqueness/recovery, current scope, legacy permission matrix,
invitation reuse/claim, session revocation, HTTP boundaries and management forms.
Changed TypeScript/TSX files passed ESLint with zero warnings. Production-source
TypeScript compilation passed using an isolated temporary config excluding historical
docs and test files; full-repository type checking is not claimed green.

## Independent review and local journey evidence

The independent reviewer identified and re-reviewed four material issues: shared-unit
booking/receipt isolation (P1), non-string action coercion (P2), a temporary-table
shadowing risk in the owner-loss trigger (P2), and unnecessary trigger mutex acquisition
on unrelated profile/password updates (P2). Fixes use the common isolation filter,
strict action/locale types, `public.identity`, and mutex acquisition only on owner loss.
The review also prompted the blocked-account revocation fix above. Regression tests
exercise table shadowing and concurrent ordinary profile writing under the held mutex.

The local Chromium journey uses only synthetic `@browser.example.test` accounts and
a separately guarded disposable browser database. It verifies real password-login UI,
local display-name persistence and disable, global profile persistence, foreign-workspace
and protected-owner denial, invitation reuse/recipient-chosen password/automatic login,
scoped appointment with global flags false, global block/unblock cookie invalidation,
local administrator revocation, and fail-closed shared-unit rendering. Results/screenshots
are in `docs/evidence/security-local/`. Email transport is deliberately disabled and
actual email delivery remains unverified. Streamed Next notFound responses can have
HTTP 200; the browser check validates the notFound UI and absence of unit data.

Full-repository typechecking was actually run on both `a0f19fe4` and `aa696a66`
with the same installed compiler/dependencies: both exited 2. The baseline produced
773 diagnostics and the candidate 770; after normalizing only source line/column
locations, both had the same 238 distinct diagnostics and no candidate-only entries.
This establishes the earlier historical docs/test errors instead of assuming they
were pre-existing. The repository's actual CI production config is checked separately.

Sequential revocation is tested. This candidate does not claim that revocation cancels
already-authorized in-flight financial commands; transaction callbacks re-read authority,
but linearizable cancellation of in-flight work is a separate concurrency contract.

The independent read-only reviewer rechecked the final fixes and reported no remaining
identified P1/P2 blocker within the reviewed scope. The reviewer inspected regression
tests but did not independently rerun them; execution evidence is from this local agent.
The production Next build and actual CI `tsconfig.production.json` both passed. Changed
files passed ESLint. No production schema, account, credential, membership or deployment
was changed.

## Final verification results

At local candidate `1f794a2c`, the complete Vitest suite passed **578 files / 6223
tests**, exit 0 (559.12 seconds), against a freshly replayed disposable local schema.
Two additional regression cases then passed in the administration suite (**31/31**):
missing/unknown/expired claim authority cannot activate or appoint the invitee, and
bounded local member edits/disable cannot commit without their audit. No application
source changed after the full-suite run. Invitation claims do not grant roles or
mark mailbox ownership verified; appointment remains a separate protected action.

Logs: `/tmp/myuno-review-candidate-final-tests.log`,
`/tmp/myuno-review-claim-boundaries.log`, `/tmp/myuno-review-build.log`,
`/tmp/myuno-review-production-types.log`, `/tmp/myuno-review-final-eslint.log`, and
`/tmp/myuno-review-claim-eslint.log`. The exact `a0f19fe4` baseline full suite also passed **576 files / 6191 tests**,
exit 0 (549.07 seconds), using the same installed dependencies and a separate
disposable database. Its additive generated Prisma client/schema was held constant
with the candidate; no legacy identities were elevated. Baseline log:
`/tmp/myuno-review-baseline-tests.log`. Structured results are recorded in
`docs/evidence/security-local/verification-results.json`.
