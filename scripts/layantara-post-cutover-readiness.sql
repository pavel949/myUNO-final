-- Layantara post-cutover verification for MyUno-final.
-- Read-only. Expected after booking authority has moved to myUNO while public
-- publication remains fail-closed until media/legal/unit readiness is complete.

with
p as (
  select * from project
  where id='layantara-project-328e43e8-942d-432a-a2a1-6ded9cbfb7de'
),
u as (
  select * from unit where project_id=(select id from p)
),
c as (
  select * from inventory_category where project_id=(select id from p)
),
o as (
  select co.*
  from commercial_offering co join u on u.id=co.unit_id
),
xs as (
  select config from external_system
  where system_key='layantara_os' and environment='source-live'
),
checks as (
  select '01_physical_units' gate, count(*)::text actual, '39' required,
         case when count(*)=39 then 'PASS' else 'BLOCK' end status from u
  union all
  select '02_categories', count(*)::text, '8',
         case when count(*)=8 then 'PASS' else 'BLOCK' end from c
  union all
  select '03_active_offerings', count(*) filter(where status='active')::text, '78',
         case when count(*) filter(where status='active')=78 then 'PASS' else 'BLOCK' end from o
  union all
  select '04_validated_tariffs',
         count(*) filter(
           where pricing_terms->>'quoteEngine'='canonical_tariff_grid_v1'
             and coalesce((pricing_terms->>'taxPolicyVerified')::boolean,false)
             and coalesce((pricing_terms->>'policyEngineVerified')::boolean,false)
         )::text,
         '78',
         case when count(*) filter(
           where pricing_terms->>'quoteEngine'='canonical_tariff_grid_v1'
             and coalesce((pricing_terms->>'taxPolicyVerified')::boolean,false)
             and coalesce((pricing_terms->>'policyEngineVerified')::boolean,false)
         )=78 then 'PASS' else 'BLOCK' end
  from o
  union all
  select '05_priced_categories', count(*) filter(where base_nightly_thb>0)::text, '8',
         case when count(*) filter(where base_nightly_thb>0)=8 then 'PASS' else 'BLOCK' end from c
  union all
  select '06_priced_units', count(*) filter(where base_nightly_thb>0)::text, '39',
         case when count(*) filter(where base_nightly_thb>0)=39 then 'PASS' else 'BLOCK' end from u
  union all
  select '07_myuno_booking_authority',
         coalesce((select config->>'bookingAuthority' from xs),'missing'),
         'myuno',
         case when (select config->>'bookingAuthority' from xs)='myuno'
                   and coalesce((select (config->>'cutoverVerified')::boolean from xs),false)
              then 'PASS' else 'BLOCK' end
  union all
  select '08_future_occupancy_evidence',
         coalesce((select config->>'futureOccupancyCount' from xs),'missing') || ':' ||
         coalesce((select config->>'futureOccupancyHash' from xs),'missing'),
         '70:829d473489bd8eeaf14a0ffe10767898',
         case when (select config->>'futureOccupancyCount' from xs)='70'
                   and (select config->>'futureOccupancyHash' from xs)='829d473489bd8eeaf14a0ffe10767898'
              then 'PASS' else 'BLOCK' end
  union all
  select '09_public_units_fail_closed',
         count(*) filter(where status='live')::text,
         '0 until per-unit readiness passes',
         case when count(*) filter(where status='live')=0 then 'PASS' else 'REVIEW' end
  from u
)
select * from checks order by gate;
