-- Pin search_path on every trigger function that resolves unqualified table
-- names, so a caller-controlled search_path cannot redirect them (Supabase
-- lint 0011_function_search_path_mutable).
--
-- The first two were pinned directly in production on 2026-08-29 and never
-- entered the migration history; recording them here keeps every environment
-- identical to production. The other five come from the 2026-09-07 to
-- 2026-09-29 migrations, which created them without a pin.
ALTER FUNCTION public.booking_snapshot_is_immutable() SET search_path = public, pg_temp;
ALTER FUNCTION public.audit_log_is_append_only() SET search_path = public, pg_temp;
ALTER FUNCTION public.project_matches_unit() SET search_path = public, pg_temp;
ALTER FUNCTION public.project_structure_node_validate() SET search_path = public, pg_temp;
ALTER FUNCTION public.unit_structure_project_validate() SET search_path = public, pg_temp;
ALTER FUNCTION public.property_deal_coherence_guard() SET search_path = public, pg_temp;
ALTER FUNCTION public.property_deal_block_guard() SET search_path = public, pg_temp;
