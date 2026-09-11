-- Close the Supabase Data API surface for canonical v3 operational/control tables.
-- Server-side Prisma uses the Postgres connection directly, so this does not
-- block authenticated application-server access.

ALTER TABLE public.service_quote_request ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_quote_version ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_reschedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_system ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_event_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_aggregate_checkpoint ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_onboarding_template ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_onboarding_draft ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE
  public.service_quote_request,
  public.service_quote_version,
  public.booking_reschedule,
  public.external_system,
  public.external_mapping,
  public.external_event_inbox,
  public.external_aggregate_checkpoint,
  public.property_onboarding_template,
  public.project_onboarding_draft
FROM anon, authenticated;

REVOKE ALL PRIVILEGES ON TABLE
  public.service_quote_request,
  public.service_quote_version,
  public.booking_reschedule,
  public.external_system,
  public.external_mapping,
  public.external_event_inbox,
  public.external_aggregate_checkpoint,
  public.property_onboarding_template,
  public.project_onboarding_draft
FROM PUBLIC;

ALTER FUNCTION public.prevent_duplicate_dispute_subject() SET search_path = pg_catalog, public;
ALTER FUNCTION public.prevent_service_quote_version_mutation() SET search_path = pg_catalog, public;
ALTER FUNCTION public.cleanup_booking_reschedule_hold() SET search_path = pg_catalog, public;
