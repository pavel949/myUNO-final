# Imported group quote and protected placements

Implemented locally for review; not deployed or applied to production.

A source reservation may quote one amount for several named villas. Preserve that quote once without allocating it equally, weighting it by current tariffs or duplicating it on each villa. Payment labels are unverified evidence, not receipts.

`ImportedReservationSource` owns the source reference, existing ReservationGroup identity, quote in integer satang, party nulls, raw payment evidence and reviewed manifest/source provenance. `ImportedReservationPlacement` links each villa to its existing BlockedDate, the existing availability authority. Its allocated amount is constrained to NULL. Booking monetary columns remain unchanged; no fake child Booking is created.

The group writer uses the canonical reservation-group helper inside one transaction, rechecks admin/system/manifest/mapping/protection state and takes deterministic unit locks. Guest mapping is reservation-reference scoped. Replay returns the existing group; changed evidence is held. New protection is created only when explicitly reviewed absent; existing protection is linked unchanged. Late conflicts and injected mid-group errors roll back the complete group write.

Database guards protect immutable source evidence/placements and linked blocks, reject ordinary Booking attachment or overlap, and extend the existing statement/payout reconciliation guard to affected group periods. An existing financial statement also causes group intake to hold the record. No Payment, Ledger, invoice, collection, refund or owner allocation is generated.

Scoped PMS display requires access to every villa in the group. It shows the source total once, unknown per-villa amounts and explicit pending financial reconciliation. Admin counts distinguish source groups/protected placements from Booking records; statement UI warns that source quotes are not recognized revenue. These records support operational placement/source review, not ordinary financial or check-in workflows.

A future allocation/cancellation transition must be separately reviewed, atomic across the group and backed by explicit evidence. This importer supplies no financial allocation or destructive reconciliation workflow. Do not ask the operator to invent a split merely to satisfy Booking's non-null money fields.

The10PostgreSQL group integration tests verify runtime retry, concurrent retry, rollback, conflicts, scope and financial guards. They also pass after the separately published SalesOffer migration. The nine pure semantic contract tests remain design examples, not production verification. Release evidence is in `docs/evidence/layantara-bounded-import-2026-10-21.md`.
