-- Audit 2026-10-01, P1 #6 — CommercialOffering controls sellability
-- (CANONICAL_STAY_DOMAIN_CONTRACT invariant 3).
--
-- The quote engine applied the offering gate only to projects with a
-- `project_type`, so live units of untyped (legacy) projects were bookable
-- with no offering at all. The gate now applies to every live unit; this
-- backfill gives each live unit that has NO stay offering an active one, so
-- the switch changes no live unit's bookability. A unit that already has a
-- stay offering in any status (e.g. a source-owned Layantara draft) is left
-- exactly as it is, and a unit linked to an external source system (its
-- calendar is source-owned until cutover) is never activated here.
-- Expand-only and idempotent.
INSERT INTO "commercial_offering" (
  "id", "created_at", "updated_at", "unit_id", "offering_type", "status",
  "pricing_terms", "rules_and_policies", "ownership_tenure"
)
SELECT
  gen_random_uuid()::text, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, u."id", 'short_stay', 'active',
  '{}'::jsonb, '{}'::jsonb, '{}'::jsonb
FROM "unit" u
WHERE u."status" = 'live'
  AND NOT EXISTS (
    SELECT 1 FROM "commercial_offering" o
    WHERE o."unit_id" = u."id" AND o."offering_type" IN ('short_stay', 'short_term_stay')
  )
  AND NOT EXISTS (
    SELECT 1 FROM "external_mapping" m
    WHERE m."entity_type" = 'unit' AND m."internal_id" = u."id"
  )
ON CONFLICT DO NOTHING;
