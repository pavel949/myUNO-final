# Direct content-photo upload candidate — 2026-10-15

Status: local candidate; not deployed or verified against real storage. This extends the existing property-content editor and MediaAsset registration, not the private-evidence or video path. Process: CO05 / CO24. Acceptance: AT16 / AT28 / AT29.

## Defect and bounded change

Vercel Functions limit request/response payloads to 4.5 MB. The content editor previously sent an image of up to 8 MiB through `/api/media/upload` as multipart data, so an otherwise-valid large image could fail before application validation. Raising an application parser limit cannot fix that platform limit.

The content editor now sends small authenticated JSON requests to the same API for initiation and finalization. Image bytes travel directly to Vercel Blob using the existing `@vercel/blob@2.8.0` public `issueSignedToken` / `presignUrl` APIs. JPEG, PNG and WebP retain the existing 8 MiB maximum. Finalization returns the existing `{ mediaAssetId, url }` shape. Existing multipart callers remain compatible; their large-file transport limitation is not resolved by this slice.

## Authority and integrity

- Server-issued intent binds the current identity, exact unit/project target and parent project, environment and issuing deployment hostname, configured store, random server-generated path, MIME, expected size and expiry. It uses a purpose-separated HMAC with the existing configured session secret; missing configuration fails closed.
- Initiation and registration reuse the existing exact content-target authorization. Active identity, live contributor grant or verified employee-created-draft receipt are rechecked in Serializable transactions; registration checks again after external byte verification. No role or publication changes occur.
- Browser receives only an exact-path, PUT-only, MIME/size-constrained, no-overwrite URL and the application registration intent. The Blob read-write token and client signing key remain server-side.
- Finalization derives the object URL from signed server-owned values, performs authenticated SDK metadata lookup, compares store/path/MIME/size and checks a bounded image signature. Redirects are rejected. This is a container-signature check, not a complete image decoder, antivirus scan or proof of image rights.
- MediaAsset storage-key uniqueness makes finalization replay idempotent only for matching owner/kind/MIME/size/privacy metadata. A foreign existing record is rejected; no ownership is rewritten.
- Media is added to the local proposed gallery only after registration is confirmed. Canonical gallery changes still require the existing proposal save/review/approval path. Public Blob storage is for public content photos; private check-in evidence must not use it.

## Recovery and UX

The UI shows prepare / transfer / registration stages, retains existing description/gallery/cover/order, and disables conflicting operations while work is pending. A lost transfer or registration response retains a target-bound registration intent in memory. Explicit retry checks finalization only, without uploading bytes again or claiming success. Beforeunload and explicit in-editor target/proposal switches warn about losing recovery context. Unmount aborts local waiting and rejects stale responses; there is no app-wide interception guard for every Next.js client-side link, and no promise of remote-write cancellation. Completed earlier files in a partial batch remain available. Discarding pending recovery does not delete a possible orphaned Blob. The PUT URL lasts at most 10 minutes; registration recovery lasts at most 24 hours in the issuing deployment. Routing to a different deployment invalidates the old intent. That rejection does not trigger a new upload automatically. Provider-enforced URL expiry is authoritative; application code does not guess storage timestamp precision or compare separate service clocks.

## CSP release review

The sole CSP change adds `https://vercel.com/api/blob/` to `connect-src`. All other directives remain unchanged. The exact SDK source generates this PUT endpoint; the storage CDN is not the upload endpoint. Browser requests use `redirect: 'error'`, omit cookies and omit referrers. Unexpected SDK API overrides and destinations are rejected. Review the deployed CSP explicitly before release; do not add speculative wildcard/HTTPS or redirect origins to silence a failure.

## Preconditions and integration

1. Reconcile the reviewed amenity-proposal/public-guidance and employee-creation candidates first. This patch depends on their current exact-target content guard and editor. Preserve separately-owned authority/navigation integrations.
2. Keep the pinned SDK lockfile; no dependency or schema change is included.
3. Verify existing configured session signing secret and an existing authorized Blob credential path/store in the intended Vercel environment. This work neither creates nor configures credentials. OIDC support is delegated to the installed SDK. An unavailable store must remain a visible error, not a data-URI or multipart fallback.
4. Preserve the existing content-label registry import and run its ordinary seed/review workflow in the release environment. New stage/recovery copy is included for EN/RU/TH/ZH, but native-language runtime review remains a gate.
5. No remote upload, production grant, database mutation, deployment or GitHub publication is part of this local evidence.

## Rollback and residual data

This is additive code without a schema migration. Reverting it restores the previous multipart editor transport and its known large-file limitation. A code rollback does not remove already registered MediaAsset rows, proposed gallery references or uploaded objects. Unregistered/orphan object cleanup requires a separate bounded operational decision; this patch neither deletes remote objects nor runs a cleanup job.

## Remaining release gates

- Full repository lint, generated-Prisma typecheck/build and existing CI on the reconciled exact head.
- PostgreSQL tests of concurrent finalization, grant/identity revocation, target reparenting and uniqueness conflicts. Mock transaction tests do not prove database locking.
- Actual Vercel browser path: a real image below 4 MB, one above 4.5 MB and at/below 8 MiB, an over-limit file, wrong MIME/signature, interrupted PUT, lost finalization response, explicit retry, partial batch, navigation and mobile/localization behavior.
- Real storage API/CORS preflight and response behavior, no required redirects, exact path/store binding, expiry and no-overwrite enforcement. No real Blob request was made here.
- Employee draft conversion → exact content target → upload → save/reload → administrator review → canonical public photo, proving no early canonical attachment. Run only with authorized isolated test data/storage.
- Video transport and its canonical media/gallery model remain outside this image-only fix. Other multipart upload callers retain their existing large-file limitation.

## Primary source contract

- Vercel Function payload limit: https://vercel.com/docs/functions/limitations#request-body-size
- Signed URL API and raw PUT example: https://vercel.com/docs/vercel-blob/vercel-signed-urls
- SDK authentication: https://vercel.com/docs/vercel-blob/using-blob-sdk#authentication
- Automatic deployment hostname: https://vercel.com/docs/environment-variables/system-environment-variables#vercel_url
- Exact SDK source: https://github.com/vercel/storage/tree/%40vercel%2Fblob%402.8.0/packages/blob/src

The local evidence bundle includes hash-verified tagged SDK source excerpts, focused test logs and an immutable patch manifest. Those are bounded source/mock evidence, not production readiness.
