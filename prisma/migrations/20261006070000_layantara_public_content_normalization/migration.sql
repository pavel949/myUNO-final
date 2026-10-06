-- Layantara public-content normalization.
-- Content text remains in ContentKey/Translation; this migration only reconciles
-- physical identity, category lifecycle and structured property-fact keys.

DO $$
DECLARE
  project_id_text text := 'layantara-project-328e43e8-942d-432a-a2a1-6ded9cbfb7de';
BEGIN
  IF (SELECT count(*) FROM unit WHERE project_id = project_id_text) <> 39 THEN
    RAISE EXCEPTION 'Layantara reconciliation expected 39 units';
  END IF;

  IF (SELECT count(*) FROM inventory_category WHERE project_id = project_id_text) <> 8 THEN
    RAISE EXCEPTION 'Layantara reconciliation expected 8 inventory categories';
  END IF;

  IF EXISTS (
    SELECT 1 FROM unit
    WHERE project_id = project_id_text AND name = 'Villa AA'
  ) AND NOT EXISTS (
    SELECT 1 FROM unit
    WHERE project_id = project_id_text AND name = 'Villa A13'
  ) THEN
    UPDATE unit
    SET name = 'Villa A13', updated_at = now()
    WHERE project_id = project_id_text AND name = 'Villa AA';
  END IF;

  UPDATE inventory_category
  SET status = 'live', updated_at = now()
  WHERE project_id = project_id_text
    AND category_key = '2BR_GARDEN_RETREAT'
    AND status = 'draft';

  UPDATE unit u
  SET unit_features = (
    SELECT coalesce(array_agg(
      CASE feature
        WHEN 'Private pool' THEN 'private_pool'
        WHEN 'Equipped kitchen' THEN 'equipped_kitchen'
        WHEN 'Comfortable indoor-outdoor living' THEN 'indoor_outdoor_living'
        WHEN 'Tropical garden alongside the pool' THEN 'tropical_garden_poolside'
        WHEN 'Peaceful garden retreat' THEN 'peaceful_garden_retreat'
        WHEN 'Spacious tropical garden' THEN 'spacious_tropical_garden'
        ELSE feature
      END
      ORDER BY ord
    ), ARRAY[]::text[])
    FROM unnest(u.unit_features) WITH ORDINALITY AS f(feature, ord)
  ),
  updated_at = now()
  WHERE u.project_id = project_id_text;

  IF EXISTS (
    SELECT 1
    FROM unit u, unnest(u.unit_features) AS feature
    WHERE u.project_id = project_id_text
      AND feature !~ '^[a-z0-9_]+$'
  ) THEN
    RAISE EXCEPTION 'Layantara reconciliation left non-canonical unit feature values';
  END IF;

  UPDATE unit
  SET status = 'live', updated_at = now()
  WHERE project_id = project_id_text
    AND asset_status <> 'suspended'
    AND status = 'draft';
END $$;
