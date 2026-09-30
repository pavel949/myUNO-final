-- Preserve the complete season-specific commercial contracts per unit.
-- These remain drafts; no seasonal quote engine or payment is fabricated.
WITH source_rate AS (
 SELECT u.id unit_id,u.project_id, r.rate_mode, r.source_rate_id,
 r.season_code,r.season_name,r.source_season_id,r.recurring_windows,r.min_nights,
 r.pricing_unit,(r.amount_thb*100)::bigint amount_satang,r.currency,
 r.includes_taxes,r.includes_service_charge,r.includes_breakfast,
 r.commission_note,r.source_document,r.source_sellable
 FROM public.unit u JOIN layantara_copy.rate_matrix r ON r.category_id=u.inventory_category_id
 WHERE u.project_id='layantara-project-328e43e8-942d-432a-a2a1-6ded9cbfb7de'
), per_unit AS (
 SELECT unit_id,project_id,
 CASE WHEN rate_mode='daily' THEN 'short_term_stay' ELSE 'long_term_rental' END offering_type,
 jsonb_agg(jsonb_build_object(
  'sourceRateId',source_rate_id,'seasonCode',season_code,'seasonName',season_name,
  'sourceSeasonId',source_season_id,'dateWindows',recurring_windows,
  'rateMode',rate_mode,'pricingUnit',pricing_unit,'amountSatang',amount_satang,
  'currency',currency,'minimumNights',min_nights,'includesTaxes',includes_taxes,
  'includesServiceCharge',includes_service_charge,'includesBreakfast',includes_breakfast,
  'agentCommissionNote',commission_note,'sourceDocument',source_document,
  'sourceSellable',source_sellable
 ) ORDER BY rate_mode,season_code,source_rate_id) rates
 FROM source_rate GROUP BY unit_id,project_id,CASE WHEN rate_mode='daily' THEN 'short_term_stay' ELSE 'long_term_rental' END
)
INSERT INTO public.commercial_offering(id,created_at,updated_at,project_id,unit_id,offering_type,status,pricing_terms,rules_and_policies,ownership_tenure)
SELECT 'layantara-offer-'||offering_type||'-'||unit_id,now(),now(),project_id,unit_id,offering_type,'draft',
 jsonb_build_object('currency','THB','tariffGrid',rates,'quoteEngine','pending_validation','sourceSystem','layantara_os'),
 jsonb_build_object('bookingPolicies',COALESCE((
   SELECT jsonb_agg(p.payload - 'created_by' - 'updated_by' ORDER BY (p.payload->>'priority')::int)
   FROM layantara_copy.source_row p
   WHERE p.source_table='booking_condition_rules' AND p.payload->>'active'='true'
     AND (p.payload->>'category_id' IS NULL OR
       EXISTS(SELECT 1 FROM public.external_mapping m JOIN public.external_system s ON s.id=m.external_system_id
         WHERE m.entity_type='unit' AND m.internal_id=per_unit.unit_id AND s.system_key='layantara_os'
           AND p.payload->>'category_id' IN (
             SELECT r.payload->>'category_id' FROM layantara_copy.source_row r
             JOIN public.external_mapping mc ON mc.external_id=r.source_id AND mc.entity_type='inventory_category' AND mc.external_system_id=s.id
             JOIN public.unit u2 ON u2.inventory_category_id=mc.internal_id AND u2.id=per_unit.unit_id
             WHERE r.source_table='villa_categories'
           )
       ))
 ),'[]'::jsonb),'reviewRequired',true),
 '{}'::jsonb
FROM per_unit
ON CONFLICT(unit_id,offering_type) DO UPDATE SET
 pricing_terms=EXCLUDED.pricing_terms,rules_and_policies=EXCLUDED.rules_and_policies,updated_at=now()
WHERE public.commercial_offering.status='draft';
