-- Canonical inventory bootstrap for existing Unit rows.
--
-- Goals:
-- 1. Every existing live unit belongs to a relational InventoryCategory.
-- 2. Every canonical category has an active BAR RatePlan.
-- 3. Unit.category_key remains a compatibility alias, but the FK is authoritative.
-- 4. A live unit cannot exist without a canonical category after this migration.
--
-- No generated IDs are hardcoded; rows are derived from current production data.

WITH profiles AS (
  SELECT DISTINCT
    u.project_id,
    u.unit_type::text AS unit_type,
    u.bedrooms,
    u.bathrooms,
    u.max_guests,
    u.base_nightly_thb,
    u.min_nights,
    COALESCE(u.cancellation_policy_key, 'flexible') AS cancellation_policy_key,
    lower(u.unit_type::text)
      || '_' || u.bedrooms::text || 'br'
      || '_' || u.bathrooms::text || 'ba'
      || '_' || u.max_guests::text || 'g'
      || '_' || u.base_nightly_thb::text AS generated_key
  FROM unit u
  WHERE u.inventory_category_id IS NULL
)
INSERT INTO inventory_category (
  id,
  created_at,
  updated_at,
  project_id,
  category_key,
  name,
  bedrooms,
  bathrooms,
  max_guests,
  base_nightly_thb,
  min_nights,
  cancellation_policy_key,
  status
)
SELECT
  gen_random_uuid()::text,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  p.project_id,
  p.generated_key,
  initcap(replace(p.unit_type, '_', ' ')) || ' ' || p.bedrooms::text || 'BR',
  p.bedrooms,
  p.bathrooms,
  p.max_guests,
  p.base_nightly_thb,
  p.min_nights,
  p.cancellation_policy_key,
  'live'
FROM profiles p
ON CONFLICT (project_id, category_key) DO NOTHING;

UPDATE unit u
SET
  inventory_category_id = ic.id,
  category_key = ic.category_key
FROM inventory_category ic
WHERE u.inventory_category_id IS NULL
  AND ic.project_id = u.project_id
  AND ic.category_key = (
    lower(u.unit_type::text)
      || '_' || u.bedrooms::text || 'br'
      || '_' || u.bathrooms::text || 'ba'
      || '_' || u.max_guests::text || 'g'
      || '_' || u.base_nightly_thb::text
  );

INSERT INTO rate_plan (
  id,
  created_at,
  updated_at,
  project_id,
  category_id,
  unit_id,
  code,
  name,
  is_master,
  parent_rate_plan_id,
  adjustment_type,
  adjustment_value,
  cancellation_policy_key,
  min_nights,
  status
)
SELECT
  gen_random_uuid()::text,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  NULL,
  ic.id,
  NULL,
  'BAR',
  'Best Available Rate',
  TRUE,
  NULL,
  NULL,
  NULL,
  COALESCE(ic.cancellation_policy_key, 'flexible'),
  ic.min_nights,
  'active'
FROM inventory_category ic
WHERE NOT EXISTS (
  SELECT 1
  FROM rate_plan rp
  WHERE rp.category_id = ic.id
    AND rp.code = 'BAR'
    AND rp.status = 'active'
);

CREATE OR REPLACE FUNCTION enforce_unit_inventory_category_coherence()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  category_project_id text;
  canonical_category_key text;
BEGIN
  IF NEW.inventory_category_id IS NULL THEN
    IF NEW.status = 'live' THEN
      RAISE EXCEPTION 'Live unit % must have an InventoryCategory', NEW.id;
    END IF;
    RETURN NEW;
  END IF;

  SELECT ic.project_id, ic.category_key
    INTO category_project_id, canonical_category_key
  FROM inventory_category ic
  WHERE ic.id = NEW.inventory_category_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory category % does not exist', NEW.inventory_category_id;
  END IF;

  IF category_project_id <> NEW.project_id THEN
    RAISE EXCEPTION 'Inventory category % belongs to project %, not unit project %',
      NEW.inventory_category_id, category_project_id, NEW.project_id;
  END IF;

  NEW.category_key := canonical_category_key;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS unit_inventory_category_coherence ON unit;
CREATE TRIGGER unit_inventory_category_coherence
BEFORE INSERT OR UPDATE OF project_id, inventory_category_id, category_key, status
ON unit
FOR EACH ROW
EXECUTE FUNCTION enforce_unit_inventory_category_coherence();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM unit
    WHERE status = 'live' AND inventory_category_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Canonical inventory bootstrap failed: live units remain without InventoryCategory';
  END IF;
END
$$;
