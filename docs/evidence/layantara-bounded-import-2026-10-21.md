# Reviewed reservation workbook import

This change prepares a bounded, administrator-reviewed import. It does not install a manifest, migrate or alter production data, publish inventory, send notifications or perform financial transactions. Operational source files, guest information, manifests and before-state exports stay outside the repository.

## Source and protection review

Manifest v3 binds the workbook hash, source revision/capture time, timezone, row digests, unit identities and exact protection IDs/notes/update timestamps. The client cannot install a manifest. Reviewed new placements explicitly declare absence of old protection; preview and apply recheck that assertion. Changes or ambiguous correspondence are held. Current scope uses checkout-exclusive Bangkok calendar dates. Cancelled records without a canonical booking remain unwritten.

Only the documented numeric reservation-ID namespace normalizes case; duplicate aliases and existing legacy mixed-case mappings are held. Missing party facts remain source-unknown. Blank payment cells remain unverified/null even when a source label says Unpaid. Quotes and bounded contact/service/operational notes remain source evidence; no receipt, settlement or verified global guest contact is inferred.

## Imported groups

One ImportedReservationSource stores the source group quote. Separate ImportedReservationPlacement records link existing BlockedDate protections; per-villa amounts remain NULL. These placements are not ordinary Booking records and do not support collection, refunds, owner allocation or ordinary check-in. Database guards protect immutable evidence and calendar blocks, prevent ordinary Booking attachment/overlap and block affected statement/payout periods. Intake also holds a group if a financial statement already exists. Scoped PMS/admin display makes these limitations explicit.

## Validation and rollout boundary

Before integration with the sales-offer main branch, the standalone aggregate passed576files/6185tests and the production build passed. A combined Prisma schema and97-migration ordering test applied the sales-offer migration first, then the earlier-named imported-group migration without rewriting history; ten group integration tests passed afterward. Rebased checks are recorded in the PR. All committed fixtures are synthetic. Synthetic backup/restore verification does not establish production recovery readiness.

Release requires independent review, latest-main integration checks, production backup/recovery evidence and a freshly reviewed source/target snapshot. Preserve ambiguous or off-unit protections; do not silently duplicate a reservation's occupancy. Install the exact server manifest through an approved configuration rollout, then use the existing authenticated admin Check/Apply path. Read back every source identity, booking/group/placement and retained block; verify no invented receipts or duplicate occupancy and repeat preview for actual idempotency. A partial import must remain labelled partial.

The migration is additive and does not depend on SalesOffer or change Booking monetary columns. An application rollback alone cannot undo imported occupancy. After import, use a separately reviewed compensating reconciliation instead of dropping evidence tables or restoring broadly over concurrent edits. Production execution and unresolved source decisions are outside this code-review change.
