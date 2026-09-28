-- Protect the 84 active source occupancies on the canonical myUNO calendar.
-- Blocks are not Bookings or Payment evidence; Layantara remains authoritative.
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('layantara-occupancy-protection'));
DO $preflight$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM layantara_copy.import_audit
   WHERE source_table='operational_occupancies' AND verified AND source_count=100)
 THEN RAISE EXCEPTION 'Occupancy snapshot is not verified'; END IF;
 IF (SELECT count(*) FROM layantara_copy.source_row
   WHERE source_table='operational_occupancies'
     AND payload->>'state'='active'
     AND payload->>'occupancy_kind' IN ('imported_reservation','owner_stay'))<>84
 THEN RAISE EXCEPTION 'Expected 84 source protections; reconcile source delta first'; END IF;
 IF EXISTS (
   SELECT 1 FROM layantara_copy.source_row o
   LEFT JOIN public.external_mapping em ON
     em.external_system_id='layantara-source-live' AND em.entity_type='unit'
     AND em.external_id=o.payload->>'inventory_id'
   WHERE o.source_table='operational_occupancies'
     AND o.payload->>'state'='active'
     AND o.payload->>'occupancy_kind' IN ('imported_reservation','owner_stay')
     AND (em.internal_id IS NULL
       OR (o.payload->>'check_in')::date>=(o.payload->>'check_out')::date)
 ) THEN RAISE EXCEPTION 'Unmapped unit or invalid range in active occupancy'; END IF;
 IF EXISTS (
   SELECT 1 FROM layantara_copy.source_row a
   JOIN layantara_copy.source_row b
   ON a.source_table='operational_occupancies'
   AND b.source_table='operational_occupancies'
   AND a.source_id<b.source_id
   AND a.payload->>'inventory_id'=b.payload->>'inventory_id'
   AND daterange((a.payload->>'check_in')::date,(a.payload->>'check_out')::date,'[)')
     && daterange((b.payload->>'check_in')::date,(b.payload->>'check_out')::date,'[)')
   WHERE a.payload->>'state'='active' AND b.payload->>'state'='active'
   AND a.payload->>'occupancy_kind' IN ('imported_reservation','owner_stay')
   AND b.payload->>'occupancy_kind' IN ('imported_reservation','owner_stay')
 ) THEN RAISE EXCEPTION 'Overlapping source protection: do not double-book'; END IF;
 IF EXISTS (
   SELECT 1 FROM layantara_copy.source_row o
   JOIN public.external_mapping em ON em.external_system_id='layantara-source-live'
      AND em.entity_type='unit' AND em.external_id=o.payload->>'inventory_id'
   JOIN public.booking b ON b.unit_id=em.internal_id
     AND b.status IN ('confirmed','checked_in','pending_payment')
     AND b.start_date < (o.payload->>'check_out')::date
     AND b.end_date > (o.payload->>'check_in')::date
   WHERE o.source_table='operational_occupancies' AND o.payload->>'state'='active'
   AND o.payload->>'occupancy_kind' IN ('imported_reservation','owner_stay')
 ) THEN RAISE EXCEPTION 'Conflicting canonical booking'; END IF;
END $preflight$;
INSERT INTO public.blocked_date(
 id,created_at,updated_at,unit_id,start_date,end_date,reason,note,external_ref
)
SELECT 'layantara-block-'||o.source_id,now(),now(),em.internal_id,
 (o.payload->>'check_in')::date,(o.payload->>'check_out')::date,
 CASE WHEN o.payload->>'occupancy_kind'='owner_stay'
 THEN 'owner_hold'::"BlockedDateReason" ELSE 'ota_import'::"BlockedDateReason" END,
 'Layantara source occupancy; confirm booking and payment identity before conversion.',
 'layantara:occupancy:'||o.source_id
FROM layantara_copy.source_row o
JOIN public.external_mapping em ON em.external_system_id='layantara-source-live'
 AND em.entity_type='unit' AND em.external_id=o.payload->>'inventory_id'
WHERE o.source_table='operational_occupancies' AND o.payload->>'state'='active'
 AND o.payload->>'occupancy_kind' IN ('imported_reservation','owner_stay')
ON CONFLICT(id) DO NOTHING;
INSERT INTO public.external_mapping(external_system_id,entity_type,external_id,internal_id,metadata)
SELECT 'layantara-source-live','occupancy_block',o.source_id,'layantara-block-'||o.source_id,
 jsonb_build_object('kind',o.payload->>'occupancy_kind','status','protected',
 'financial_reconciliation','required','source_state',o.payload->>'state')
FROM layantara_copy.source_row o
WHERE o.source_table='operational_occupancies' AND o.payload->>'state'='active'
 AND o.payload->>'occupancy_kind' IN ('imported_reservation','owner_stay')
ON CONFLICT(external_system_id,entity_type,external_id) DO NOTHING;
DO $validate$
BEGIN
 IF (SELECT count(*) FROM public.blocked_date
   WHERE external_ref LIKE 'layantara:occupancy:%')<>84
 THEN RAISE EXCEPTION 'Expected 84 protected occupancy rows'; END IF;
 IF EXISTS (
 SELECT 1 FROM layantara_copy.source_row o
 JOIN public.blocked_date b ON b.id='layantara-block-'||o.source_id
 WHERE o.source_table='operational_occupancies' AND o.payload->>'state'='active'
 AND o.payload->>'occupancy_kind' IN ('imported_reservation','owner_stay')
 AND (b.start_date<>(o.payload->>'check_in')::date
 OR b.end_date<>(o.payload->>'check_out')::date)
 ) THEN RAISE EXCEPTION 'Protected date drift'; END IF;
END $validate$;
COMMIT;
