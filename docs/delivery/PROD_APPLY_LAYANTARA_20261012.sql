BEGIN;
DO $$
DECLARE
  pid text := 'layantara-project-328e43e8-942d-432a-a2a1-6ded9cbfb7de';
  unit_n integer;
  cat_n integer;
  flipped integer;
BEGIN
  SELECT count(*) INTO unit_n FROM unit WHERE project_id = pid;
  SELECT count(*) INTO cat_n FROM inventory_category WHERE project_id = pid;
  IF unit_n <> 39 OR cat_n <> 8 THEN
    RAISE EXCEPTION 'Layantara expected 39 units and 8 categories, found % and %', unit_n, cat_n;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM external_system WHERE system_key = 'layantara_os' AND (config->>'cutoverVerified') = 'true' AND (config->>'bookingAuthority') = 'myuno') THEN
    RAISE EXCEPTION 'Layantara booking cutover is not verified';
  END IF;

  UPDATE unit SET permitted_use_confirmed_at = now(), updated_at = now() WHERE project_id = pid AND permitted_use_confirmed_at IS NULL;
  INSERT INTO audit_log (id, created_at, actor_identity_id, action, entity_type, entity_id, data, at) VALUES (gen_random_uuid()::text, now(), NULL, 'units:permitted_use_founder_exception', 'Project', pid, '{"decision":"founder 2026-10-12","basis":"resort stated hotel licence","licence_number":"pending Q29","regulatory_credential":"none recorded; go-live credential gate not applied","units":39}'::jsonb, now());

  IF EXISTS (SELECT 1 FROM unit WHERE project_id = pid AND name = 'Villa AA') AND NOT EXISTS (SELECT 1 FROM unit WHERE project_id = pid AND name = 'Villa A13') THEN
    UPDATE unit SET name = 'Villa A13', updated_at = now() WHERE project_id = pid AND name = 'Villa AA';
  END IF;

  UPDATE inventory_category SET status = 'live', updated_at = now() WHERE project_id = pid AND category_key = '2BR_GARDEN_RETREAT' AND status = 'draft';

  UPDATE unit u SET unit_features = (
    SELECT coalesce(array_agg(k ORDER BY first_ord), ARRAY[]::text[]) FROM (
      SELECT k, min(ord) AS first_ord FROM (
        SELECT CASE feature
          WHEN 'Private pool' THEN 'private_pool'
          WHEN 'Equipped kitchen' THEN 'equipped_kitchen'
          WHEN 'Comfortable indoor-outdoor living' THEN 'indoor_outdoor_living'
          WHEN 'Tropical garden alongside the pool' THEN 'tropical_garden_poolside'
          WHEN 'Peaceful garden retreat' THEN 'peaceful_garden_retreat'
          WHEN 'Spacious tropical garden' THEN 'spacious_tropical_garden'
          ELSE feature END AS k, ord
        FROM unnest(u.unit_features) WITH ORDINALITY AS f(feature, ord)
      ) mapped GROUP BY k
    ) dedup
  ), updated_at = now()
  WHERE u.project_id = pid AND EXISTS (SELECT 1 FROM unnest(u.unit_features) x WHERE x !~ '^[a-z0-9_]+$');

  IF EXISTS (SELECT 1 FROM unit u, unnest(u.unit_features) feature WHERE u.project_id = pid AND feature !~ '^[a-z0-9_]+$') THEN
    RAISE EXCEPTION 'Layantara left non-canonical unit feature values';
  END IF;

  UPDATE unit u SET status = 'live', updated_at = now()
  WHERE u.project_id = pid AND u.status = 'draft' AND u.asset_status <> 'suspended'
    AND u.permitted_use_confirmed_at IS NOT NULL
    AND EXISTS (SELECT 1 FROM inventory_category c WHERE c.id = u.inventory_category_id AND c.status = 'live');
  GET DIAGNOSTICS flipped = ROW_COUNT;
  IF flipped <> 39 THEN
    RAISE EXCEPTION 'Expected to publish 39 units, would publish %', flipped;
  END IF;
  INSERT INTO audit_log (id, created_at, actor_identity_id, action, entity_type, entity_id, data, at) VALUES (gen_random_uuid()::text, now(), NULL, 'units:published_layantara', 'Project', pid, '{"decision":"founder 2026-10-12","units":39,"gates":"category live, permitted use set by founder exception, cutover verified, not suspended"}'::jsonb, now());
END $$;
INSERT INTO "_prisma_migrations"(id,checksum,migration_name,started_at,finished_at,applied_steps_count,logs) VALUES (gen_random_uuid()::text,'d8756edc3274e10f40c358d3c5cb99b945231518ee935c49fd49c49684ebd040','20261006070000_layantara_public_content_normalization',now(),now(),1,'applied manually 2026-10-12 as guarded script docs/delivery/PROD_APPLY_LAYANTARA_20261012.sql');
COMMIT;
select (select count(*) from unit where project_id = 'layantara-project-328e43e8-942d-432a-a2a1-6ded9cbfb7de' and status = 'live') live_units, (select count(*) from unit where project_id = 'layantara-project-328e43e8-942d-432a-a2a1-6ded9cbfb7de' and permitted_use_confirmed_at is not null) permitted_use_set, (select count(*) from unit where project_id = 'layantara-project-328e43e8-942d-432a-a2a1-6ded9cbfb7de' and name = 'Villa A13') villa_a13, (select count(*) from inventory_category where project_id = 'layantara-project-328e43e8-942d-432a-a2a1-6ded9cbfb7de' and status = 'live') live_categories, (select count(*) from "_prisma_migrations" where migration_name = '20261006070000_layantara_public_content_normalization') journal_rows;
