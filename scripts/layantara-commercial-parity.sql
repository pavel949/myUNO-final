-- READ ONLY: commercial-engine migration parity, not historical finance sign-off.
-- Never equate legacy LT-* DEMO catalog rows with confirmed operational villas.
WITH project AS (
 SELECT id FROM public.project
 WHERE id='layantara-project-328e43e8-942d-432a-a2a1-6ded9cbfb7de'
), units AS (
 SELECT id,inventory_category_id FROM public.unit WHERE project_id=(SELECT id FROM project)
), offers AS (
 SELECT unit_id,offering_type,status,pricing_terms
 FROM public.commercial_offering WHERE project_id=(SELECT id FROM project)
), source_rates AS (
 SELECT source_rate_id,category_id,rate_mode,amount_thb
 FROM layantara_copy.rate_matrix
), mapped_rates AS (
 SELECT DISTINCT v->>'sourceRateId' source_id
 FROM offers o CROSS JOIN LATERAL jsonb_array_elements(o.pricing_terms->'tariffGrid') v
), catalog AS (
 SELECT source_table,count(*)::int n FROM layantara_copy.source_row GROUP BY 1
), checks AS (
 SELECT 'physical_units' gate,(SELECT count(*)::text FROM units) actual,'39' expected,
 (SELECT count(*) FROM units)=39 passed
 UNION ALL SELECT 'physical_identity_crosswalk',
 (SELECT count(*)::text FROM public.external_mapping m JOIN public.external_system e ON e.id=m.external_system_id
  WHERE e.system_key='layantara_os' AND m.entity_type='unit' AND m.internal_id IN(SELECT id FROM units)),'39',
 (SELECT count(*) FROM public.external_mapping m JOIN public.external_system e ON e.id=m.external_system_id
  WHERE e.system_key='layantara_os' AND m.entity_type='unit' AND m.internal_id IN(SELECT id FROM units))=39
 UNION ALL SELECT 'category_types',
 (SELECT count(DISTINCT inventory_category_id)::text FROM units),'8',
 (SELECT count(DISTINCT inventory_category_id) FROM units)=8
 UNION ALL SELECT 'daily_and_long_term_offers',
 (SELECT count(*)::text FROM offers),'78',
 (SELECT count(*) FROM offers)=78
 UNION ALL SELECT 'seasonal_rate_coverage',
 (SELECT count(*)::text FROM mapped_rates),
 (SELECT count(*)::text FROM source_rates),
 NOT EXISTS(SELECT source_rate_id FROM source_rates EXCEPT SELECT source_id FROM mapped_rates)
 AND NOT EXISTS(SELECT source_id FROM mapped_rates EXCEPT SELECT source_rate_id FROM source_rates)
 UNION ALL SELECT 'localized_category_content',
 (SELECT n::text FROM catalog WHERE source_table='villa_category_content'),'24',
 (SELECT n FROM catalog WHERE source_table='villa_category_content')=24
 UNION ALL SELECT 'legacy_demo_villas_quarantined',
 (SELECT count(*)::text FROM layantara_copy.source_row WHERE source_table='villas'
  AND payload->>'rate_is_demo'='true'),
 '39 demo entries must NOT be mapped as physical units',
 (SELECT count(*) FROM layantara_copy.source_row WHERE source_table='villas'
  AND payload->>'rate_is_demo'='true')=39
 AND NOT EXISTS(SELECT 1 FROM public.external_mapping m JOIN public.external_system e ON e.id=m.external_system_id
  WHERE e.system_key='layantara_os' AND m.entity_type='unit'
  AND m.external_id IN (SELECT source_id FROM layantara_copy.source_row WHERE source_table='villas'))
 UNION ALL SELECT 'physical_photo_coverage',
 (SELECT count(DISTINCT unit_id)::text FROM public.unit_media WHERE unit_id IN(SELECT id FROM units)),
 '39 units with independently verified real media',
 (SELECT count(DISTINCT unit_id) FROM public.unit_media WHERE unit_id IN(SELECT id FROM units))=39
 UNION ALL SELECT 'source_physical_media_rehosted',
 (SELECT count(*)::text FROM public.external_mapping m JOIN public.external_system e ON e.id=m.external_system_id
  WHERE e.system_key='layantara_os' AND m.entity_type='photo' AND m.metadata->>'physicalCopyComplete'='true'
  AND m.metadata->>'sourceSha256'=m.metadata->>'targetSha256'),
 '67',
 (SELECT count(*) FROM public.external_mapping m JOIN public.external_system e ON e.id=m.external_system_id
  WHERE e.system_key='layantara_os' AND m.entity_type='photo' AND m.metadata->>'physicalCopyComplete'='true'
  AND m.metadata->>'sourceSha256'=m.metadata->>'targetSha256')=67
 UNION ALL SELECT 'real_specification_verified',
 (SELECT count(*)::text FROM layantara_copy.source_row WHERE source_table='villa_master_crosswalk'
  AND payload->>'specification_verification_status'='confirmed'),'39',
 (SELECT count(*) FROM layantara_copy.source_row WHERE source_table='villa_master_crosswalk'
  AND payload->>'specification_verification_status'='confirmed')=39
)
SELECT gate,actual,expected,CASE WHEN passed THEN 'PASS' ELSE 'BLOCK' END status
FROM checks ORDER BY gate;