# myUNO Canonical v3 — Production Cutover Evidence

**Date:** 2026-09-11  
**Repository:** `pavel949/myUNO-final`  
**Release:** Canonical v3 / PR #64  
**Purpose:** auditable record of the production database cutover and final deployment gate.

## 1. Release state

PR #64 has been merged to `main`. The first production deployment of the merged release failed before the final cutover was complete. This document records the production-side corrections made before the release was retried.

## 2. Content review gate

The production build is intentionally blocked while `translation.status = 'needs_review'` rows exist. The release contained seeded canonical RU/EN/TH copy still carrying that review status. Founder authorization to proceed to completion was treated as approval of the current canonical seeded copy for this release.

Production action:

- all existing `needs_review` translations were promoted to `ok`;
- post-action verification: `needs_review = 0`.

Future editorial changes continue to use the normal content review gate.

## 3. Production database cutover

Production Supabase project: `burcnghheyzbzffzgmjz`.

Immediately before the v3 structural cutover:

- `service_order = 0` rows;
- `booking = 0` rows;
- `ledger_entry = 0` rows;
- `dispute = 0` rows;
- `service_project = 0` rows.

The low transactional volume made the additive migration cutover low-risk. Existing project/unit/content data was preserved.

The following canonical v3 migrations were applied in dependency order through the Supabase migration API:

1. `service_order_close_window`
2. `service_order_closed_event`
3. `dispute_subject_concurrency_guard`
4. `canonical_commerce_federation_onboarding`
5. `reschedule_hold_cleanup`
6. `seed_onboarding_templates`

The Supabase migration registry records them as production migrations on 2026-09-11.

## 4. Post-migration verification

Verified directly against production PostgreSQL:

- `service_order.project_id` is nullable;
- standalone service context columns exist;
- property-specific service economics columns exist;
- quote request/version tables exist;
- booking reschedule replacement-hold table exists;
- federation system/mapping/inbox/checkpoint tables exist;
- onboarding template/draft tables exist;
- all 9 expected new canonical tables are present;
- 3 starter onboarding templates are present;
- `translation.needs_review = 0`.

## 5. Safety notes

- No synthetic `All Phuket` project was introduced.
- Existing production transaction rows were not rewritten because the affected transaction tables were empty at cutover.
- The earlier structural migration had already been rehearsed in a rollback transaction; that rehearsal caught and corrected the TEXT-vs-UUID identifier mismatch before production application.
- Production migration history already used Supabase-generated version timestamps for some older repository migrations. The cutover preserves that history rather than rewriting it.

## 6. Final deployment gate

A fresh Vercel deployment must compile and complete successfully after this cutover. Only after a green production deployment should runtime smoke tests be considered final evidence.

Required smoke checks:

- public home page responds successfully;
- public services catalog responds successfully;
- `/api/services` responds successfully;
- protected admin/owner surfaces remain protected;
- RU/EN/TH public rendering does not throw;
- no material production runtime errors are observed during the smoke window.

This document records the database/content cutover only. It must not be interpreted as a successful deployment until the corresponding Vercel status is green.
