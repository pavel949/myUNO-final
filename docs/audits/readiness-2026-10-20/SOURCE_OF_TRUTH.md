# Source-of-truth inspection anchors

These are current source locators, not a certification of all writers/readers.

| Fact | Inspected anchor | Assurance |
|---|---|---|
| Effective access | src/modules/core/permissions.ts | Central aliases and role/action scope matrix; live resource isolation not verified |
| Booking allocation | prisma/migrations/20260818000014_booking_no_overlap_exclusion/migration.sql | DB exclusion covers confirmed/checked_in/pending_payment; production installation unknown |
| Money/provider | src/modules/finance/providers/index.ts; opn.ts | Mock refused in production; real API adapter exists; account charge/refund unverified |
| Service lifecycle | src/modules/services/service-order.service.ts; service-order-closure.ts | Focused closure/context tests pass; live full order/settlement not verified |
| Public readiness | src/modules/projects/unit-publication-readiness.ts; src/lib/launch-readiness.ts | Local mocked readiness tests pass; real data/config not inspected |
| Scheduler | .github/workflows/scheduler.yml; vercel.json; src/jobs/health.ts | Five-minute intended trigger; measured dispatch gaps |
| Messaging | src/modules/integrations/messenger.ts | Explicitly unimplemented channel send/ingest adapters |
| Release truth | Connected Vercel alias/deployment metadata | Served source older than main |
