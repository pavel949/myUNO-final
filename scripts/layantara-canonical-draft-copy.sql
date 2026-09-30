-- Idempotent canonical draft inventory copy from verified private Layantara snapshots.
-- Never changes source DB, opens sales, creates payments, or rewrites existing target records.
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('layantara-canonical-draft-copy'));
DO $preflight$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM layantara_copy.import_audit
   WHERE source_table='operational_inventory' AND verified AND source_count=39)
 OR NOT EXISTS (SELECT 1 FROM layantara_copy.import_audit
   WHERE source_table='villa_categories' AND verified AND source_count=8)
 OR NOT EXISTS (SELECT 1 FROM layantara_copy.import_audit
   WHERE source_table='villa_master_crosswalk' AND verified AND source_count=39)
 THEN RAISE EXCEPTION 'Missing verified Layantara inventory/category/crosswalk snapshots'; END IF;
 IF EXISTS (
   SELECT 1 FROM layantara_copy.source_row i
   LEFT JOIN layantara_copy.source_row c ON c.source_table='villa_categories'
     AND c.source_id=i.payload->>'category_id'
   LEFT JOIN layantara_copy.source_row w ON w.source_table='villa_master_crosswalk'
     AND w.payload->>'inventory_id'=i.source_id
   WHERE i.source_table='operational_inventory'
     AND (c.source_id IS NULL OR w.source_id IS NULL
       OR w.payload->>'operational_verification_status'<>'confirmed'
       OR w.payload->>'category_verification_status'<>'confirmed')
 ) THEN RAISE EXCEPTION 'Inventory/category identity crosswalk is incomplete'; END IF;
 IF (SELECT count(DISTINCT payload->>'unit_code') FROM layantara_copy.source_row
   WHERE source_table='operational_inventory')<>39
 THEN RAISE EXCEPTION 'Duplicate physical unit code'; END IF;
 IF EXISTS (SELECT 1 FROM public.project WHERE slug='layantara-villas'
   AND id<>'layantara-project-328e43e8-942d-432a-a2a1-6ded9cbfb7de')
 THEN RAISE EXCEPTION 'Existing project slug requires manual reconciliation'; END IF;
END $preflight$;
INSERT INTO public.external_system(id,system_key,environment,display_name,status,config)
VALUES ('layantara-source-live','layantara_os','source-live','Layantara OS (source retained)','staging',
 '{"mode":"read_only","cutover":"pending","source_preserved":true}'::jsonb)
ON CONFLICT(id) DO NOTHING;
INSERT INTO public.project(
 id,slug,name,area_label_key,description_key,latitude,longitude,address,timezone,
 handbook_key,status,project_type,hospitality_classification,operational_status,
 country,region,city,total_units,updated_at
)
SELECT 'layantara-project-'||p.source_id,'layantara-villas',p.payload->>'name',
 'layantara.area.layan','layantara.project.description',0,0,
 COALESCE(pr.payload->>'address',p.payload->>'location'),
 COALESCE(p.payload->>'timezone','Asia/Bangkok'),
 'layantara.project.handbook','draft'::"ProjectStatus",
 'villa_resort','serviced_villas','migration_staging','TH','Phuket','Phuket',39,now()
FROM layantara_copy.source_row p
LEFT JOIN layantara_copy.source_row pr ON pr.source_table='project_public_profile'
 AND pr.payload->>'project_id'=p.source_id
WHERE p.source_table='projects' AND p.source_id='328e43e8-942d-432a-a2a1-6ded9cbfb7de'
ON CONFLICT(id) DO NOTHING;
INSERT INTO public.external_mapping(external_system_id,entity_type,external_id,internal_id,metadata)
SELECT 'layantara-source-live','project',p.source_id,'layantara-project-'||p.source_id,
 '{"verified":"identity","stage":"draft"}'::jsonb
FROM layantara_copy.source_row p WHERE p.source_table='projects'
ON CONFLICT(external_system_id,entity_type,external_id) DO NOTHING;
INSERT INTO public.inventory_category(
 id,project_id,category_key,name,bedrooms,bathrooms,max_guests,
 base_nightly_thb,min_nights,status,updated_at
)
SELECT 'layantara-category-'||c.source_id,
 'layantara-project-'||(c.payload->>'project_id'),c.payload->>'code',
 c.payload->>'name',COALESCE((c.payload->>'bedrooms')::int,0),0,
 COALESCE((c.payload->>'max_guests')::int,(c.payload->>'bedrooms')::int*2,0),
 0,1,'draft',now()
FROM layantara_copy.source_row c WHERE c.source_table='villa_categories'
ON CONFLICT(id) DO NOTHING;
INSERT INTO public.external_mapping(external_system_id,entity_type,external_id,internal_id,metadata)
SELECT 'layantara-source-live','inventory_category',c.source_id,
 'layantara-category-'||c.source_id,
 jsonb_build_object('code',c.payload->>'code','specification','pending_review')
FROM layantara_copy.source_row c WHERE c.source_table='villa_categories'
ON CONFLICT(external_system_id,entity_type,external_id) DO NOTHING;
INSERT INTO public.unit(
 id,project_id,name,unit_type,bedrooms,bathrooms,max_guests,
 size_sqm,address_supplement,base_nightly_thb,min_nights,instant_book,status,
 category_key,inventory_category_id,privacy_type,accommodation_type,
 usable_area_sqm,gross_area_sqm,outdoor_area_sqm,plot_area_sqm,updated_at
)
SELECT 'layantara-unit-'||i.source_id,'layantara-project-'||(i.payload->>'project_id'),
 'Villa '||(i.payload->>'unit_code'),'villa'::"UnitType",
 COALESCE((i.payload->>'bedrooms')::int,(c.payload->>'bedrooms')::int,0),
 COALESCE(floor((i.payload->>'bathrooms')::numeric)::int,0),
 COALESCE((c.payload->>'max_guests')::int,0),
 CASE WHEN i.payload->>'internal_area_sqm' IS NOT NULL
   THEN round((i.payload->>'internal_area_sqm')::numeric)::int ELSE NULL END,
 i.payload->>'unit_code',0,1,false,'draft'::"UnitStatus",
 c.payload->>'code','layantara-category-'||c.source_id,
 'entire_home','private_pool_villa',
 (i.payload->>'internal_area_sqm')::numeric,
 (i.payload->>'total_building_area_sqm')::numeric,
 (i.payload->>'external_area_sqm')::numeric,
 (i.payload->>'plot_area_sqm')::numeric,now()
FROM layantara_copy.source_row i
JOIN layantara_copy.source_row c ON c.source_table='villa_categories'
 AND c.source_id=i.payload->>'category_id'
WHERE i.source_table='operational_inventory'
ON CONFLICT(id) DO NOTHING;
INSERT INTO public.external_mapping(external_system_id,entity_type,external_id,internal_id,metadata)
SELECT 'layantara-source-live','unit',i.source_id,'layantara-unit-'||i.source_id,
 jsonb_build_object('unit_code',i.payload->>'unit_code',
 'category_id',i.payload->>'category_id',
 'operational_verification',w.payload->>'operational_verification_status',
 'category_verification',w.payload->>'category_verification_status',
 'specification_verification',w.payload->>'specification_verification_status',
 'availability_authority','layantara_until_cutover','sellable',false)
FROM layantara_copy.source_row i
JOIN layantara_copy.source_row w ON w.source_table='villa_master_crosswalk'
 AND w.payload->>'inventory_id'=i.source_id
WHERE i.source_table='operational_inventory'
ON CONFLICT(external_system_id,entity_type,external_id) DO NOTHING;
DO $validate$
BEGIN
 IF (SELECT count(*) FROM public.unit WHERE project_id=
 'layantara-project-328e43e8-942d-432a-a2a1-6ded9cbfb7de')<>39
 OR (SELECT count(*) FROM public.inventory_category WHERE project_id=
 'layantara-project-328e43e8-942d-432a-a2a1-6ded9cbfb7de')<>8
 OR (SELECT count(*) FROM public.external_mapping
 WHERE external_system_id='layantara-source-live' AND entity_type='unit')<>39
 THEN RAISE EXCEPTION 'Canonical draft copy is not 39 units, 8 categories and 39 mappings'; END IF;
 IF EXISTS (SELECT 1 FROM public.unit WHERE project_id=
 'layantara-project-328e43e8-942d-432a-a2a1-6ded9cbfb7de'
 AND (status<>'draft' OR instant_book OR base_nightly_thb<>0))
 THEN RAISE EXCEPTION 'Unsafe saleable unit found'; END IF;
END $validate$;
COMMIT;
