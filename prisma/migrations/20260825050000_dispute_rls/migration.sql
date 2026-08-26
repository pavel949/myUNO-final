-- `dispute` (added in 20260825044246_disputes) was created after
-- 20260824000021_rls_every_table's one-time sweep, so it was born exposed
-- through Supabase's public REST endpoint the same way every table added
-- after that sweep would be. Re-running the identical idempotent loop closes
-- it and stays correct for any table added between now and the next sweep.

DO $$
DECLARE
  target regclass;
BEGIN
  FOR target IN
    SELECT c.oid::regclass
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'          -- ordinary tables only; views have no RLS
      AND NOT c.relrowsecurity
  LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', target);
  END LOOP;
END
$$;
