# Approved release excluding protected administrator changes

Application source: `be5843c04f4d36e5edb00bd49984df1473869df0`.
Target: existing Vercel project `prj_GonhJLt1m9T060dxDBnSZtuiiWYj`, alias `my-uno-final.vercel.app`.

Only pending SQL approved for this release, in order:

1. `20261021010000_booking_refund_dispatch_authorization`
2. `20261021023000_imported_reservation_groups`
3. `20261021140000_sales_offer_desk`

Their exact checksums are already pinned in the application commit's production migration policy. The scoped runner loads that policy and dependencies from the immutable application checkout, not current main. It rejects the administrator migration and any other pending SQL. Existing refund authorizations remain null; no backfill or financial replay is part of this release.

The control workflow runs only on main, requires successful exact-main CI for both its actual control SHA and the approved historical application SHA, and verifies their ancestor relationship. Both checkouts are pinned and the application tracked tree must remain clean. The existing backup workflow can now check out an exact source SHA and returns that SHA only after restore verification and encrypted artifact storage succeed. Existing scheduled and ordinary callers retain their default caller-SHA behavior. Backup destination, encryption, all-table restore comparison, dedicated reader and 30-day retention remain unchanged.

Scoped migration requires the successful backup attestation to equal the application SHA, rechecks current control main after backup, revalidates ledger checksums and scope, and compares financial table counts/digests before and after. No workflow deploys automatically. Deployment is a separate explicit action using the approved application SHA. No fake GitHub SHA or backup-verification value is supplied.

No administrator schema, bootstrap, invitations, role assignments, manifest installation, real booking import, tariff approvals or guest messages are included. Eight operational import holds remain. A code-only rollback cannot undo an actual import; no import is authorized here.

Credential readiness is separate. The authorized Supabase connector can read production in a database-enforced read-only transaction. The existing backup reader previously passed backup and restore. GitHub's separate repository Actions `DATABASE_URL` previously failed password authentication. Vercel's production `DATABASE_URL` is sensitive: the supported environment API returned metadata without a value. No credential was extracted, reset, changed or logged. A supported secure source for the existing valid migration credential is still needed before correction and production execution.

Required sequence: approve/review this control change; pass exact control-head and merged-main checks; securely correct the existing GitHub migration credential if necessary; run scoped read-only preflight; run guarded backup/restore and only the three migrations; independently verify schema and parity; deploy exact application SHA; verify READY, alias and read-only public/admin functionality. Preserve the unexplained first-attempt browser hydration418/parentNode observation as a residual smoke-test concern, despite subsequent unchanged-code and integration passes.
