-- Read-only Layantara activation preflight. Run ONLY against the intended, verified
-- target environment as an authorized operator. No passenger/guest/PII output.
-- A PASS here is necessary but NOT sufficient: signed source-vs-target booking,
-- payment, staff and legal/compliance reconciliation remains mandatory.
-- This query does not update project, unit, offering or source authority.
WITH
p AS (
 SELECT id,latitude,longitude,status FROM public.project
 WHERE id='layantara-project-328e43e8-942d-432a-a2a1-6ded9cbfb7de'
),
u AS (
 SELECT id,inventory_category_id,status,base_nightly_thb,instant_book
 FROM public.unit WHERE project_id=(SELECT id FROM p)
),
cat AS (
 SELECT id FROM public.inventory_category WHERE project_id=(SELECT id FROM p)
),
sys AS (
 SELECT id,status,config FROM public.external_system
 WHERE system_key='layantara_os' AND environment='source-live'
),
mapped AS (
 SELECT m.internal_id,m.external_id,m.metadata
 FROM public.external_mapping m JOIN sys s ON s.id=m.external_system_id
 WHERE m.entity_type='unit'
),
offering AS (
 SELECT unit_id,offering_type,status,pricing_terms FROM public.commercial_offering
 WHERE project_id=(SELECT id FROM p)
),
gates AS (
 SELECT '01_source_snapshot_counts' gate,
 (SELECT count(*)::text FROM layantara_copy.import_audit
   WHERE verified AND source_count=copied_count) actual,
 (SELECT count(*)::text FROM layantara_copy.import_audit) required,
 NOT EXISTS (SELECT 1 FROM layantara_copy.import_audit WHERE NOT verified OR source_count<>copied_count)
 AND EXISTS (SELECT 1 FROM layantara_copy.import_audit) passed
 UNION ALL SELECT '02_real_physical_units', (SELECT count(*)::text FROM u),'39',
 (SELECT count(*) FROM u)=39
 UNION ALL SELECT '03_categories', (SELECT count(*)::text FROM cat),'8',
 (SELECT count(*) FROM cat)=8
 UNION ALL SELECT '04_unique_verified_crosswalk',(SELECT count(*)::text FROM mapped),'39',
 (SELECT count(*) FROM mapped)=39
 AND (SELECT count(DISTINCT internal_id) FROM mapped)=39
 AND (SELECT count(DISTINCT external_id) FROM mapped)=39
 AND NOT EXISTS(SELECT 1 FROM mapped
   WHERE metadata->>'operational_verification'<>'confirmed'
      OR metadata->>'category_verification'<>'confirmed')
 UNION ALL SELECT '05_categories_assigned', (SELECT count(*)::text FROM u WHERE inventory_category_id IS NOT NULL),'39',
 (SELECT count(*) FROM u WHERE inventory_category_id IN(SELECT id FROM cat))=39
 UNION ALL SELECT '06_verified_real_coordinates',
 COALESCE((SELECT latitude::text||','||longitude::text FROM p),'absent'),'non-zero valid coordinates',
 EXISTS(SELECT 1 FROM p WHERE latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180
 AND latitude<>0 AND longitude<>0)
 UNION ALL SELECT '07_verified_physical_specs',
 (SELECT count(*)::text FROM layantara_copy.source_row
   WHERE source_table='villa_master_crosswalk'
   AND payload->>'specification_verification_status'='confirmed'),'39',
 (SELECT count(*) FROM layantara_copy.source_row
   WHERE source_table='villa_master_crosswalk'
   AND payload->>'specification_verification_status'='confirmed')=39
 UNION ALL SELECT '08_physical_gallery',
 (SELECT count(DISTINCT unit_id)::text FROM public.unit_media WHERE unit_id IN(SELECT id FROM u)),'39 units with media',
 (SELECT count(DISTINCT unit_id) FROM public.unit_media WHERE unit_id IN(SELECT id FROM u))=39
 UNION ALL SELECT '09_confirmed_sellable_rates',
 (SELECT count(DISTINCT unit_id)::text FROM offering
   WHERE offering_type='short_term_stay' AND status='active'
     AND pricing_terms->>'quoteEngine'<>'pending_validation'),'39 independently validated',
 (SELECT count(DISTINCT unit_id) FROM offering
   WHERE offering_type='short_term_stay' AND status='active'
     AND pricing_terms->>'quoteEngine'<>'pending_validation')=39
 UNION ALL SELECT '10_staged_inventory_not_prematurely_live',
 (SELECT count(*)::text FROM u WHERE status='live' OR instant_book),'0 until authority handover',
 (SELECT count(*) FROM u WHERE status='live' OR instant_book)=0
 UNION ALL SELECT '11_source_authority_preserved',
 COALESCE((SELECT config->>'bookingAuthority' FROM sys LIMIT 1),'missing'),'source',
 EXISTS(SELECT 1 FROM sys WHERE config->>'bookingAuthority'='source'
   AND COALESCE((config->>'cutoverVerified')::boolean,false)=false)
)
SELECT gate,actual,required,
 CASE WHEN passed THEN 'PASS' ELSE 'BLOCK' END status
FROM gates ORDER BY gate;
