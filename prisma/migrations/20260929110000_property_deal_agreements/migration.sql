-- One agreement per canonical CRM opportunity. Booking and title history remain
-- separate authorities; closing a deal does not fabricate a payment or change
-- ownership. Monetary values are integer satang in THB.
CREATE TABLE public.property_deal (
  id text PRIMARY KEY,
  created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp(3) NOT NULL,
  opportunity_id text NOT NULL REFERENCES public.crm_opportunity(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  offering_id text NOT NULL REFERENCES public.commercial_offering(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  unit_id text NOT NULL REFERENCES public.unit(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  kind text NOT NULL CHECK (kind IN ('sale','long_term_rental')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','proposed','accepted','signed','closed','cancelled')),
  amount_thb integer NOT NULL CHECK (amount_thb > 0),
  deposit_thb integer NOT NULL DEFAULT 0 CHECK (deposit_thb >= 0),
  currency text NOT NULL DEFAULT 'THB' CHECK (currency='THB'),
  starts_on date,
  ends_on date,
  terms_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  contract_media_id text REFERENCES public.media_asset(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  completion_media_id text REFERENCES public.media_asset(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  accepted_at timestamp(3),
  signed_at timestamp(3),
  closed_at timestamp(3),
  settlement_reference text,
  handover_at timestamp(3),
  CONSTRAINT property_deal_opportunity_id_key UNIQUE(opportunity_id),
  CONSTRAINT property_deal_lease_dates CHECK (
    kind <> 'long_term_rental' OR (starts_on IS NOT NULL AND ends_on IS NOT NULL AND ends_on>starts_on)
  )
);
CREATE INDEX property_deal_unit_id_status_idx ON public.property_deal(unit_id,status);
CREATE INDEX property_deal_offering_id_status_idx ON public.property_deal(offering_id,status);

ALTER TABLE public.blocked_date ADD COLUMN property_deal_id text;
ALTER TABLE public.blocked_date ADD CONSTRAINT blocked_date_property_deal_id_key UNIQUE(property_deal_id);
ALTER TABLE public.blocked_date ADD CONSTRAINT blocked_date_property_deal_id_fkey
  FOREIGN KEY(property_deal_id) REFERENCES public.property_deal(id)
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Protect unit/offering/CRM identity against direct SQL or stale clients.
CREATE OR REPLACE FUNCTION public.property_deal_coherence_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM public.commercial_offering o
   WHERE o.id=NEW.offering_id AND o.unit_id=NEW.unit_id AND o.offering_type=NEW.kind
 ) THEN RAISE EXCEPTION 'Agreement offering must match physical unit and deal kind'; END IF;
 IF NOT EXISTS (
   SELECT 1 FROM public.crm_opportunity c
   WHERE c.id=NEW.opportunity_id AND c.unit_id=NEW.unit_id
     AND ((NEW.kind='sale' AND c.type IN ('purchase','sale'))
       OR (NEW.kind='long_term_rental' AND c.type='rental'))
 ) THEN RAISE EXCEPTION 'Agreement must match canonical CRM opportunity and unit'; END IF;
 IF TG_OP='UPDATE' AND OLD.status IN ('signed','closed') AND
   (NEW.unit_id<>OLD.unit_id OR NEW.offering_id<>OLD.offering_id
    OR NEW.opportunity_id<>OLD.opportunity_id OR NEW.kind<>OLD.kind
    OR NEW.amount_thb<>OLD.amount_thb OR NEW.deposit_thb<>OLD.deposit_thb
    OR NEW.starts_on IS DISTINCT FROM OLD.starts_on
    OR NEW.ends_on IS DISTINCT FROM OLD.ends_on
    OR NEW.contract_media_id IS DISTINCT FROM OLD.contract_media_id) THEN
   RAISE EXCEPTION 'Signed commercial terms are immutable';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER property_deal_coherence_guard_trg
 BEFORE INSERT OR UPDATE ON public.property_deal FOR EACH ROW
 EXECUTE FUNCTION public.property_deal_coherence_guard();

CREATE OR REPLACE FUNCTION public.property_deal_block_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.property_deal_id IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM public.property_deal d WHERE d.id=NEW.property_deal_id
     AND d.unit_id=NEW.unit_id AND d.kind='long_term_rental'
     AND d.starts_on=NEW.start_date AND d.ends_on=NEW.end_date
 ) THEN RAISE EXCEPTION 'Lease calendar block must match signed agreement dates and unit'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER property_deal_block_guard_trg BEFORE INSERT OR UPDATE OF
 property_deal_id,unit_id,start_date,end_date ON public.blocked_date
 FOR EACH ROW EXECUTE FUNCTION public.property_deal_block_guard();

ALTER TABLE public.property_deal ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.property_deal FROM PUBLIC,anon,authenticated;
