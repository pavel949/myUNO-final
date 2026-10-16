# Delegated descriptive property creation

## Canonical path

The employee entry is `/property/create`. It saves and submits the existing creator-owned `CrmOpportunity` property intake (`source = myuno_property_submission_v1`). `/app/admin/property-submissions` reviews that intake and the existing conversion writer creates canonical `Project` or `Unit` records in `draft` status. An employee's next edit uses `/property/content?scope=unit|project&targetId=...`, the existing proposal and administrator-review workflow. No second inventory model is introduced.

`create_unit` and `create_complex` are independent `OperatingSpaceMember.capabilities` values. Only the existing founder/administrator governance writer manages them in this first slice. Manager delegation is not implemented. Creation does not imply daily operations, pricing, reservations, ownership, publication or permission to delegate.

A nonempty, active operating space and organization with current verified operating relationships are required. Unit creation is limited to the projects represented by eligible units currently attached to that exact space. New complex intake is bound to the explicit space and organization; it does not create or infer a management mandate. Empty or unsupported scopes fail closed and show a no-scope state. New records are not automatically attached to the portfolio.

## Controlled creation receipt

The existing JSON intake contains a versioned, strict server-owned `employeeCreation` receipt. This is a deliberately controlled extension of the established onboarding record, not client-writable authority JSON. It binds the CRM row ID, creator ID, original membership ID, space, organization, creation kind, original project scope, request/revision history and exact newly-created output IDs. The receipt and canonical relational columns must agree. A malformed reserved marker fails closed; it never falls back to ordinary owner intake.

Only the dedicated creation and conversion services construct or advance the receipt. Public intake, generic CRM creation and generic requirements updates reject attempts to inject or replace it. Generic requirements editing also cannot erase a governed receipt or modify the employee lifecycle. Ordinary CRM stage and activity writers do not change that provenance.

Current identity, membership, space, organization, eligible attachments and verified operating evidence are rechecked within a transaction at save, submission, conversion and every derived content-proposal access or application. Original membership ID binding prevents deletion and recreation of an unrelated membership from reviving a receipt. The authority rows are locked during commands; serializable conflicts return a reload/review response rather than silently retrying an uncertain mutation.

Only the creator's exact newly-created output, while still a draft and while the original creation authority remains valid, supplies content-proposal access. A newly-created complex supplies no child-unit access. Siblings, other employees' outputs and matched existing records supply no rights. Existing independently assigned content-contributor access continues through its original guard.

## Review and recovery

The UI uses an explicit workspace and project, revision checking, request IDs, pending-write input locks and readback for uncertain save outcomes. Request IDs are bound to the normalized request body; reuse with changed data conflicts. Conversion remains atomic with canonical draft creation and receipt linking.

Duplicate suggestions are bounded: unit hints come only from eligible attached units in the selected project; complex hints contain public live projects or the current eligible project scope. Administrator matching uses explicit canonical IDs and current server validation. Matching an existing record changes no existing facts, media, ownership, offerings or engagement, and creates no derived editing right.

An active creator can still read their own authored intake after grant revocation. That read-only projection omits canonical enrichment, review notes and canonical output links when current exact access is absent. A disabled identity loses access entirely. Revocation blocks saves, conversion and later proposal approval. The UI marks retained intake read-only.

## Compatibility and limitations

- Existing public owner intake remains available and retains its original conversion behavior.
- Active authorized administrators retain the canonical `/api/admin/units` draft writer.
- Nonadministrator `/ops/new-unit` entry redirects to the reviewed employee intake with an explicit transition notice. The backend rejects the old direct-create shortcut with `employee_creation_review_required` and its destination. Repository callers were inspected; external integrations or production traffic have not been measured.
- This slice does not publish listings or activate commercial offerings, booking, fees, ownership or mandates. Separate existing readiness and publication authority remains necessary.
- No schema migration is introduced. No real user grants or production authorization changes are part of implementation verification.
- Advisory duplicate protection covers onboarding conversion writers. Existing canonical administrator writers retain their own duplicate rules; no global fuzzy-deduplication guarantee is made.
- Workspace navigation, the exact-target server page and central seed registration changes are separate integration hunks against the authority candidate's preimages. They must be reconciled before calling the employee journey integrated.

## Verification gates

Focused mocked service/API and component tests cover receipt forgery, cross-scope denial, revocation, read-only retained intake, separate capabilities, pending-write races, canonical draft conversion and exact-target proposal continuity. Real PostgreSQL integration cases cover atomicity, serializable races and lock/revocation behavior. `scripts/e2e/employee-creation.mjs` uses the existing isolated fixture/egress contract and drives founder grants, creator intake, administrator conversion and content review.

The local review environment has no generated Prisma client or isolated PostgreSQL/browser application. Prepared integration/browser cases are not execution evidence. Full repository typecheck, migration/DB tests, production build and the isolated browser acceptance job must run on the final composed commit. Production is Vercel; this feature does not require Netlify.

### Process mapping and rollout

This is the descriptive intake portion of CO05, with CO22 capability delegation and CO24 reviewed content continuity. It does not claim completion of all onboarding, employee lifecycle, or publication readiness. Membership capabilities are existing CONFIGURATION; the immutable creation receipt is controlled EVENT/provenance; submitted descriptions remain proposed intake until the canonical writer applies them. Project/Unit facts remain CANONICAL.

Roll out only after composing the reviewed dependency and integration hunks, running full CI and isolated acceptance on the exact commit, and checking the Vercel deployment separately. Enable real employee rights only through an independently authorized founder action. Recovery for application errors is readback/reload followed by review; unknown mutation outcomes are not automatically retried. Disabling or revoking a creation capability immediately closes this receipt-derived editing path while retaining active creators' own intake history. A code rollback must preserve stored receipts and continue blocking generic/public writes to their reserved marker; removing those protections while employee records exist is unsafe.

### Upload acceptance still required

After conversion, the exact-target content editor provides the existing gallery upload, cover, ordering and removal controls. It calls `/api/media/upload`; saving/submitting then uses `/api/property-content-proposals`, and the administrator reviews at `/app/admin/property-content-proposals`. These controls do not establish production transport readiness.

The current route advertises an 8 MiB file limit and sends the full multipart body through the application function. Vercel request-body limits may reject files below that UI limit. The production storage seam also requires the configured Vercel Blob store. The existing isolated production-server job deliberately supplies no external storage credentials and blocks egress, so this runner does not claim a successful real upload.

Remaining acceptance cases on an approved isolated storage setup or explicitly authorized production test:

1. Upload a real JPEG/PNG/WebP smaller than 4 MiB from the newly-created draft's exact-target editor. Verify a successful API response, owned public MediaAsset metadata, gallery/cover proposal persistence after reload, administrator review, and final rendered image. Record the exact commit and environment.
2. Attempt a file near the current advertised limit and one exceeding it. Verify truthful client/server rejection, no false success, no lost text or previously uploaded images, no duplicate request, and clear recovery. Do not reduce the UI limit merely to report this gate as passed; reconcile the production transport explicitly.
3. Video upload and playback remain a separate outstanding path. This image-only slice adds no video claim or new video transport.
