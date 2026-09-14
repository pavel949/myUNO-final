-- Canonical inventory-category link hardening.
--
-- `Unit.category_key` predates the relational InventoryCategory model. Keep it
-- as a compatibility alias while callers migrate, but make the FK authoritative
-- whenever it is present and repair all rows that can be matched safely.

UPDATE "unit" AS u
SET "inventory_category_id" = ic."id"
FROM "inventory_category" AS ic
WHERE u."inventory_category_id" IS NULL
  AND u."category_key" IS NOT NULL
  AND ic."project_id" = u."project_id"
  AND ic."category_key" = u."category_key";

CREATE OR REPLACE FUNCTION enforce_unit_inventory_category_coherence()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  category_project_id text;
  canonical_category_key text;
BEGIN
  IF NEW."inventory_category_id" IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT ic."project_id", ic."category_key"
    INTO category_project_id, canonical_category_key
  FROM "inventory_category" ic
  WHERE ic."id" = NEW."inventory_category_id";

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory category % does not exist', NEW."inventory_category_id";
  END IF;

  IF category_project_id <> NEW."project_id" THEN
    RAISE EXCEPTION 'Inventory category % belongs to project %, not unit project %',
      NEW."inventory_category_id", category_project_id, NEW."project_id";
  END IF;

  -- The FK is canonical. While category_key remains for backwards-compatible
  -- clients, keep the alias synchronized and reject contradictory writes.
  IF NEW."category_key" IS NULL THEN
    NEW."category_key" := canonical_category_key;
  ELSIF NEW."category_key" <> canonical_category_key THEN
    RAISE EXCEPTION 'Unit category_key % disagrees with canonical InventoryCategory key %',
      NEW."category_key", canonical_category_key;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS unit_inventory_category_coherence ON "unit";
CREATE TRIGGER unit_inventory_category_coherence
BEFORE INSERT OR UPDATE OF "project_id", "inventory_category_id", "category_key"
ON "unit"
FOR EACH ROW
EXECUTE FUNCTION enforce_unit_inventory_category_coherence();
