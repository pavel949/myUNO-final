-- Idempotent, non-sellable canonical content and rate-plan adaptation.
-- Full seasonal/agent/monthly tariff remains unit-safe in the private matrix.
CREATE OR REPLACE VIEW layantara_copy.rate_matrix AS
SELECT r.source_id AS source_rate_id, c.internal_id AS category_id,
       c.external_id AS source_category_id, s.source_id AS source_season_id,
       s.payload->>'code' AS season_code, s.payload->>'name' AS season_name,
       s.payload->>'rate_mode' AS rate_mode,
       s.payload->'date_windows' AS recurring_windows,
       NULLIF(s.payload->>'min_nights','')::int AS min_nights,
       r.payload->>'pricing_unit' AS pricing_unit,
       (r.payload->>'amount')::numeric AS amount_thb,
       r.payload->>'currency' AS currency,
       (r.payload->>'active')::boolean AS active,
       (r.payload->>'is_sellable')::boolean AS source_sellable,
       r.payload->'includes_taxes' AS includes_taxes,
       r.payload->'includes_service_charge' AS includes_service_charge,
       r.payload->'includes_breakfast' AS includes_breakfast,
       r.payload->>'agent_commission_note' AS commission_note,
       r.payload->>'source_document' AS source_document
FROM layantara_copy.source_row r
JOIN layantara_copy.source_row s ON s.source_table='rate_seasons' AND s.source_id=r.payload->>'season_id'
JOIN public.external_system x ON x.system_key='layantara_os'
JOIN public.external_mapping c ON c.external_system_id=x.id
 AND c.entity_type='inventory_category' AND c.external_id=r.payload->>'category_id'
WHERE r.source_table='category_rates';
REVOKE ALL ON layantara_copy.rate_matrix FROM PUBLIC, anon, authenticated;

INSERT INTO public.rate_plan(id,created_at,updated_at,project_id,code,name,is_master,min_nights,status,cancellation_policy_key)
SELECT 'layantara-plan-'||source_id,now(),now(),
 'layantara-project-328e43e8-942d-432a-a2a1-6ded9cbfb7de',
 payload->>'code',payload->>'name',
 payload->>'code'='FLEX',NULLIF(payload->>'min_nights','')::int,'draft',
 'layantara.rate.'||lower(payload->>'code')||'.cancellation'
FROM layantara_copy.source_row WHERE source_table='rate_plans'
ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,min_nights=EXCLUDED.min_nights,
 cancellation_policy_key=EXCLUDED.cancellation_policy_key,updated_at=now();

-- Each category shares one canonical content key for all three locale translations.
INSERT INTO public.content_key(id,created_at,updated_at,key,namespace,description,supports_rich)
SELECT 'layantara-category-description-'||source_id,now(),now(),
 'layantara.category.'||source_id||'.description','stay',
 'Layantara canonical category description',false
FROM layantara_copy.source_row WHERE source_table='villa_categories'
ON CONFLICT(id) DO NOTHING;
INSERT INTO public.content_key(id,created_at,updated_at,key,namespace,description,supports_rich)
VALUES ('layantara-project-public-description',now(),now(),'layantara.project.description','stay','Verified Layantara project description',false)
ON CONFLICT(id) DO NOTHING;
INSERT INTO public.translation(id,created_at,updated_at,content_key_id,locale,value,status,updated_by_identity_id)
SELECT 'layantara-translation-'||s.source_id,now(),now(),
 'layantara-category-description-'||(s.payload->>'category_id'),
 s.payload->>'locale',s.payload->>'description','needs_review',
 (SELECT id FROM public.identity WHERE is_admin ORDER BY id LIMIT 1)
FROM layantara_copy.source_row s
WHERE s.source_table='villa_category_content' AND s.payload->>'published'='true'
ON CONFLICT(id) DO UPDATE SET value=EXCLUDED.value,updated_at=now();
INSERT INTO public.translation(id,created_at,updated_at,content_key_id,locale,value,status,updated_by_identity_id)
SELECT 'layantara-project-about-en',now(),now(),'layantara-project-public-description',
 'en',payload->>'short_description','needs_review',
 (SELECT id FROM public.identity WHERE is_admin ORDER BY id LIMIT 1)
FROM layantara_copy.source_row WHERE source_table='project_public_profile'
ON CONFLICT(id) DO UPDATE SET value=EXCLUDED.value,updated_at=now();

UPDATE public.project SET project_type='resort',total_units=39,
 description_key='layantara.project.description',
 hospitality_config=jsonb_build_object('source','layantara_os','configurationStatus','imported_not_activated',
 'sourceOperatingProfile',(SELECT payload->'settings' FROM layantara_copy.source_row WHERE source_table='property_operating_profiles'),
 'sourceCapabilities',(SELECT payload->'capabilities' FROM layantara_copy.source_row WHERE source_table='property_operating_profiles'),
 'bookingMode','request','channelSync','manual',
 'sourceBookingTerms','private_reconciliation'),
 updated_at=now()
WHERE id='layantara-project-328e43e8-942d-432a-a2a1-6ded9cbfb7de';

UPDATE public.inventory_category c SET
 cancellation_policy_key='layantara.rate.flex.cancellation',
 updated_at=now()
WHERE c.project_id='layantara-project-328e43e8-942d-432a-a2a1-6ded9cbfb7de';
UPDATE public.unit u SET instant_book=false,
 description_key='layantara.category.'||m.external_id||'.description',
 updated_at=now()
FROM public.external_mapping m JOIN public.external_system s ON s.id=m.external_system_id
WHERE m.internal_id=u.inventory_category_id AND m.entity_type='inventory_category'
 AND s.system_key='layantara_os'
 AND u.project_id='layantara-project-328e43e8-942d-432a-a2a1-6ded9cbfb7de';
