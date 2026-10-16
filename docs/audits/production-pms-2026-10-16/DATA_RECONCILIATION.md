# Production reconciliation

Read-only aggregates: 44 live units; 0 management contracts; 0 canonical bookings; 0 payments; 0 service orders; 2 buyer signals. Zero booking→unit or payment→booking orphans; zero open inventory-blocking operational tasks. These counts are observations, not evidence of mandates or a validated 55-unit source manifest. No source inventory, pricing, occupancy, media or financial history was changed.

The 39-villa Layantara source manifest, live source PMS, tariff Golden Master, external occupancy and payment identities were not re-extracted or reconciled in this task. Existing protected imported occupancy must remain protected. No authority cutover or source decommission is approved by this audit.

All 10 job keys had successful recorded runs. Before repair, frequent jobs last ran at 07:45 UTC, incompatible with their intended 5/15-minute cadence. After re-enabling Scheduler and dispatching frequent, booking_lifecycle, tm30_escalations and ical_sync recorded success at 10:50 UTC; results were 0 holds/requests, 0 TM30 cases, 0 synced feeds/conflicts. No work volume was invented.

Content gate: 4213 translations have needs_review, including 603 staff and 225 ops translations. Production env metadata does not define CONTENT_REVIEW_GATE_ENABLED. The build gate defaults on; an enabled production gate will reject these drafts. No translation was bulk-approved and the gate was not disabled.

Photo check: anonymous GET /api/media/direct-upload returns 404 on production. No claim of successful remote bytes, finalize recovery, saved gallery or image rendering is made.
