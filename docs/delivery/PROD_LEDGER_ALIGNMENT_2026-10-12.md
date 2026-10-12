# Production Prisma ledger alignment — 2026-10-12

Authorised by the founder. Applied to Supabase `burcnghheyzbzffzgmjz` as a single INSERT into `_prisma_migrations`
(idempotent: `WHERE NOT EXISTS`), after read-only verification that every object each migration creates already exists.

| Migration | Objects verified on prod | Recorded |
|---|---|---|
| 20261005130000_project_portal_nearby_places | table `project_nearby_place`, 2 indexes, RLS on | yes |
| 20261005134500_homepage_placements | table `homepage_placement`, 2 indexes, RLS on | yes |
| 20261005150000_homepage_funnel_events | 15 `AnalyticsEventKey` values | yes |
| 20261005170000_stitch_additive_gaps | `booking.reference` + unique index, table `service_order_dispatch` (+RLS), `operational_task.checklist` | yes |
| 20261006090000_booking_channel_expedia_trip_com | `BookingChannel` values `expedia`, `trip_com` | yes |
| **20261006070000_layantara_public_content_normalization** | **NOT applied: Villa AA not renamed, 1 draft category, 124 non-canonical unit features, 39 draft units** | **no — left pending on purpose** |

The Layantara migration is a production-data repair that also flips 39 units to `live` (public). That is a publication
decision, not a journal fix, so it was neither run nor recorded. `prisma migrate deploy` will still apply it; run it only
when the founder confirms the units should go live.

Caveat: the journal also holds legacy rows named `3_…`–`8_…` that have no folder in `prisma/migrations`; whether
`migrate deploy` tolerates them was not verified (no production connection string in the session).
