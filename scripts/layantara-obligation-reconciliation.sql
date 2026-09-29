-- Read-only identity/obligation reconciliation after the staged physical-inventory copy.
-- No personal data or guest identifiers are returned. Inspect exceptions in a
-- privileged private workflow; never import a reservation as a fake payment.
-- NOTE: counts are a necessary, not sufficient, condition for an approved
-- per-source-ID/hash and financial reconciliation.
WITH project AS (
 SELECT id FROM public.project
 WHERE id='layantara-project-328e43e8-942d-432a-a2a1-6ded9cbfb7de'
), ids AS (
 SELECT id FROM public.unit WHERE project_id=(SELECT id FROM project)
), source AS (
 SELECT source_table,count(*)::int AS n
 FROM layantara_copy.source_row GROUP BY source_table
), audited AS (
 SELECT count(*)::int AS n,
 count(*) FILTER(WHERE verified AND source_count=copied_count
 AND source_checksum=target_checksum)::int AS matching
 FROM layantara_copy.import_audit
), checks AS (
 SELECT 'snapshot_checksum_parity' AS gate,
 (SELECT matching::text FROM audited) actual,
 (SELECT n::text FROM audited) expected,
 (SELECT n>0 AND n=matching FROM audited) passed
 UNION ALL SELECT 'canonical_villa_count',
 (SELECT count(*)::text FROM ids),'39',(SELECT count(*) FROM ids)=39
 UNION ALL SELECT 'canonical_category_count',
 (SELECT count(*)::text FROM public.inventory_category WHERE project_id=(SELECT id FROM project)),
 (SELECT n::text FROM source WHERE source_table='villa_categories'),
 (SELECT count(*) FROM public.inventory_category WHERE project_id=(SELECT id FROM project))=
 (SELECT n FROM source WHERE source_table='villa_categories')
 UNION ALL SELECT 'category_content_snapshot',
 (SELECT n::text FROM source WHERE source_table='villa_category_content'),
 '24 source records; verify localized publication separately',
 (SELECT n FROM source WHERE source_table='villa_category_content')=24
 UNION ALL SELECT 'rate_grid_preserved',
 (SELECT count(*)::text FROM layantara_copy.rate_matrix),
 (SELECT n::text FROM source WHERE source_table='category_rates'),
 (SELECT count(*) FROM layantara_copy.rate_matrix)=(SELECT n FROM source WHERE source_table='category_rates')
 UNION ALL SELECT 'source_photo_links_preserved',
 (SELECT count(*)::text FROM public.unit_media WHERE unit_id IN (SELECT id FROM ids)),
 (SELECT n::text FROM source WHERE source_table='villa_media'),
 (SELECT count(*) FROM public.unit_media WHERE unit_id IN (SELECT id FROM ids))=
 (SELECT n FROM source WHERE source_table='villa_media')
 UNION ALL SELECT 'source_reservations_to_canonical_bookings',
 (SELECT count(*)::text FROM public.booking WHERE project_id=(SELECT id FROM project)),
 (SELECT n::text FROM source WHERE source_table='reservations'),
 (SELECT count(*) FROM public.booking WHERE project_id=(SELECT id FROM project))=
 (SELECT n FROM source WHERE source_table='reservations')
 UNION ALL SELECT 'source_occupancy_fully_resolved',
 (SELECT count(*)::text FROM public.blocked_date
  WHERE unit_id IN(SELECT id FROM ids) AND external_ref LIKE 'layantara:occupancy:%'),
 (SELECT count(*)::text FROM layantara_copy.source_row
  WHERE source_table='operational_occupancies'
  AND payload->>'state'='active'),
 (SELECT count(*) FROM public.blocked_date
  WHERE unit_id IN(SELECT id FROM ids) AND external_ref LIKE 'layantara:occupancy:%')=
 (SELECT count(*) FROM layantara_copy.source_row
  WHERE source_table='operational_occupancies' AND payload->>'state'='active')
 UNION ALL SELECT 'source_paid_evidence_reconciled',
 (SELECT count(*)::text FROM public.external_mapping m JOIN public.external_system e ON e.id=m.external_system_id
 WHERE e.system_key='layantara_os' AND m.entity_type='payment'),
 (SELECT n::text FROM source WHERE source_table='payments'),
 (SELECT count(*) FROM public.external_mapping m JOIN public.external_system e ON e.id=m.external_system_id
 WHERE e.system_key='layantara_os' AND m.entity_type='payment')=
 (SELECT n FROM source WHERE source_table='payments')
 UNION ALL SELECT 'no_premature_public_bookability',
 (SELECT count(*)::text FROM public.unit WHERE id IN(SELECT id FROM ids)
 AND (status='live' OR instant_book)), '0',
 NOT EXISTS(SELECT 1 FROM public.unit WHERE id IN(SELECT id FROM ids)
 AND (status='live' OR instant_book))
)
SELECT gate,actual,expected,CASE WHEN passed THEN 'PASS' ELSE 'BLOCK' END status
FROM checks ORDER BY gate;
