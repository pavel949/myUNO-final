-- Defense in depth: a source-linked Layantara unit cannot become a second
-- independent booking writer merely because an operator marks its Unit live.
-- This guard applies to ALL ORM/API writers, not just public checkout.
CREATE OR REPLACE FUNCTION public.enforce_layantara_booking_cutover()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  source_owned boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.external_mapping m
    JOIN public.external_system s ON s.id = m.external_system_id
    WHERE m.entity_type = 'unit'
      AND m.internal_id = NEW.unit_id
      AND s.system_key = 'layantara_os'
      AND s.status IN ('active', 'staging')
      AND NOT (
        s.config->>'bookingAuthority' = 'myuno'
        AND s.config->'cutoverVerified' = 'true'::jsonb
      )
  ) INTO source_owned;

  IF NOT source_owned THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'Layantara unit remains source-owned: verified cutover required before new bookings'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'layantara_source_booking_authority';
  END IF;

  -- Existing stays may progress to checkout, cancel or complete normally.
  -- They cannot acquire or expand sold inventory under the wrong writer.
  IF NEW.status IN ('pending_payment', 'confirmed', 'checked_in')
     AND (
       OLD.status NOT IN ('pending_payment', 'confirmed', 'checked_in')
       OR OLD.unit_id IS DISTINCT FROM NEW.unit_id
       OR OLD.start_date IS DISTINCT FROM NEW.start_date
       OR OLD.end_date IS DISTINCT FROM NEW.end_date
       OR OLD.total_thb IS DISTINCT FROM NEW.total_thb
     ) THEN
    RAISE EXCEPTION 'Layantara unit remains source-owned: verified cutover required before booking changes'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'layantara_source_booking_authority';
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.enforce_layantara_booking_cutover() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_layantara_booking_cutover() FROM anon, authenticated;
DROP TRIGGER IF EXISTS booking_layantara_cutover_guard ON public.booking;
CREATE TRIGGER booking_layantara_cutover_guard
  BEFORE INSERT OR UPDATE ON public.booking
  FOR EACH ROW EXECUTE FUNCTION public.enforce_layantara_booking_cutover();
