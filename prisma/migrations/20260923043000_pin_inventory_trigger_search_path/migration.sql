-- Pin the trigger function's object-resolution path so caller-controlled
-- search_path values cannot change which inventory_category relation is used.
ALTER FUNCTION public.enforce_unit_inventory_category_coherence()
SET search_path = public, pg_temp;
