-- One physical home can have three independent business offers without duplication.
CREATE UNIQUE INDEX IF NOT EXISTS commercial_offering_unit_type_unique ON public.commercial_offering(unit_id,offering_type) WHERE unit_id IS NOT NULL;
COMMENT ON INDEX public.commercial_offering_unit_type_unique IS 'One unit; distinct short-stay, long-stay and sale offers.';