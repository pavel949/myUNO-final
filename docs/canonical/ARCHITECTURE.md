# ARCHITECTURE.md — myUNO Target Technical Architecture

## 1. Style
Use a modular monolith by default. Boundaries are domain contracts first. Do not split into microservices for aesthetics.

## 2. Layers
```text
Experience: public / guest / owner / partner / property / control plane
Application: commands / queries / orchestration / auth
Domain: identity / assets / scope / stay / services / finance / standards
Integration: Layantara / channels / payments / messaging / accounting / external PMS
Persistence: canonical myUNO PostgreSQL + justified federated operational stores
```

## 3. Database topology
`MyUno-final` DB is the target global/control-plane canonical store. Layantara remains federated for specialized resort operations until deliberate cutover. Future ordinary properties live in shared myUNO DB.

## 4. Integration contracts
Use `ExternalSystem`, `ExternalRecordLink`, `BusinessEvent`, `IntegrationCheckpoint`, idempotency and explicit command endpoints. Do not mirror every table, sync both ways by default, query Layantara tables directly from myUNO UI, or map by display name.

## 5. Event roles
`AuditLog` = who changed what. `AnalyticsEvent` = product telemetry. `BusinessEvent` = domain occurrence.

## 6. Read models
Party360, Property360, Unit360, Stay360, Owner360, Provider360, Portfolio, Search, Readiness and Compliance are rebuildable projections, not write-side truth.

## 7. Multi-tenancy
Scope chain: platform → organization → property/project → collection → unit. Identity and authority are separate. Use organization membership, scoped role assignment and operating authority.

## 8. API
Commands are authenticated, validated, transactional, idempotent where retryable, audited/event-producing. Queries are bounded/scoped. Public APIs return explicit DTO allowlists, never raw Prisma serialization.

## 9. Search
Start with PostgreSQL indexed projections: destination, property, collection, unit, capacity/features, booking eligibility, canonical price reference, availability, responsibility label, service capability, public status.

## 10. Scalability
Before service splitting: indexing, query plans, public projection caching, async events, job reliability, media optimization. Split only when a measured bottleneck and stable domain boundary justify distributed complexity.

## 11. Release architecture
Use expand → compatible deploy → backfill → parity → writer/read cutover → observe → contract later. Build must not mutate production schema/history implicitly.

## 12. Resilience
Backup, restore rehearsal, job health, adapter retry, quarantine/dead-letter, integration lag, stale-availability blocking and payment idempotency are platform requirements.

## 13. Security
No privileged DB credentials in browser. Server domain services enforce authorization. Minimize direct Supabase Data API exposure unless explicit RLS is designed/tested. Partner/owner lateral access must be tested. Private evidence and public media use different delivery rules.

## 14. External-system environment identity
`ExternalSystem` unique by `(system_key, environment)`. Mapping unique by `(external_system_id, entity_type, source_record_id)`. Business-event idempotency by `(external_system_id, source_event_id)`. Preview/staging IDs must never collide with production.

## 15. Event delivery
Target at-least-once delivery with idempotent effects, not fictional distributed exactly-once. Use durable source outbox/event ledger, destination inbox, retry/backoff, unknown-version quarantine, replay, sequence/version protection and lag metrics.

## 16. Authority commands
Read projections cannot confirm bookings. External authority commands such as quote/hold/confirm/cancel/requestTask use explicit signed backend contracts with idempotency and expected version where applicable. Timeout means unknown/pending, never success.

## 17. Caching
Scope and identity/organization context participate in private cache keys. Private 360 projections never share public caches.
