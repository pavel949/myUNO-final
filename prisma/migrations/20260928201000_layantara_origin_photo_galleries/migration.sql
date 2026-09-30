-- Link all verified, public source photos to the same canonical Unit records.
-- These are live, attributed source URLs; physical Blob rehosting is a separate task.
WITH files AS (
 SELECT s.source_id,
 'https://omwoglpcwaiflaprgrne.supabase.co/storage/v1/object/public/villa-media/'||
   replace(s.payload->>'storage_path',' ','%20') AS url,
 s.payload,
 m.internal_id AS unit_id
 FROM layantara_copy.source_row s
 JOIN public.external_system x ON x.system_key='layantara_os'
 JOIN public.external_mapping m ON m.external_system_id=x.id AND m.entity_type='unit'
    AND m.external_id=s.payload->>'inventory_id'
 WHERE s.source_table='villa_media'
 AND s.payload->>'published'='true' AND s.payload->>'mime_type' IN ('image/jpeg','image/png','image/webp')
)
INSERT INTO public.media_asset(id,created_at,updated_at,storage_key,kind,mime_type,size_bytes,uploaded_by_identity_id,encrypted)
SELECT 'layantara-source-media-'||source_id,now(),now(),url,'photo',
 payload->>'mime_type',(payload->>'byte_size')::int,
 (SELECT id FROM public.identity WHERE is_admin ORDER BY id LIMIT 1),false
FROM files
ON CONFLICT(id) DO UPDATE SET storage_key=EXCLUDED.storage_key,mime_type=EXCLUDED.mime_type,
 size_bytes=EXCLUDED.size_bytes,updated_at=now();

WITH files AS (
 SELECT s.source_id, m.internal_id unit_id,
 COALESCE(NULLIF(s.payload->>'sort_order','')::int,100) sort
 FROM layantara_copy.source_row s
 JOIN public.external_system x ON x.system_key='layantara_os'
 JOIN public.external_mapping m ON m.external_system_id=x.id AND m.entity_type='unit'
   AND m.external_id=s.payload->>'inventory_id'
 WHERE s.source_table='villa_media' AND s.payload->>'published'='true'
)
INSERT INTO public.unit_media(unit_id,media_id,sort)
SELECT unit_id,'layantara-source-media-'||source_id,sort FROM files
ON CONFLICT(unit_id,media_id) DO UPDATE SET sort=EXCLUDED.sort;

WITH ranked AS (
 SELECT m.internal_id unit_id,'layantara-source-media-'||s.source_id media_id,
 row_number() over(partition by m.internal_id order by
   case when s.payload->>'is_cover'='true' then 0 else 1 end,
   COALESCE(NULLIF(s.payload->>'sort_order','')::int,100),s.source_id) rn
 FROM layantara_copy.source_row s
 JOIN public.external_system x ON x.system_key='layantara_os'
 JOIN public.external_mapping m ON m.external_system_id=x.id AND m.entity_type='unit'
   AND m.external_id=s.payload->>'inventory_id'
 WHERE s.source_table='villa_media' AND s.payload->>'published'='true'
)
UPDATE public.unit u SET cover_media_id=r.media_id,updated_at=now()
FROM ranked r WHERE r.rn=1 AND r.unit_id=u.id AND u.cover_media_id IS NULL;

INSERT INTO public.external_mapping(external_system_id,entity_type,external_id,internal_id,metadata)
SELECT x.id,'photo',s.source_id,'layantara-source-media-'||s.source_id,
 jsonb_build_object('storageOrigin','layantara_public_bucket','physicalCopyComplete',false,
   'sourcePath',s.payload->>'storage_path','fileSize',s.payload->'byte_size')
FROM layantara_copy.source_row s CROSS JOIN public.external_system x
WHERE x.system_key='layantara_os' AND s.source_table='villa_media' AND s.payload->>'published'='true'
ON CONFLICT(external_system_id,entity_type,external_id) DO UPDATE SET
 metadata=EXCLUDED.metadata,updated_at=now();
