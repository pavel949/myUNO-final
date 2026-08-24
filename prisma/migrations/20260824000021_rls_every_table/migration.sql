-- Row-level security on every table in `public`, as a migration rather than as
-- something somebody remembered to click.
--
-- Doc 15 §2.3 records RLS being enabled across the database in August 2026 —
-- a real remediation, because with it off Supabase's PostgREST endpoint exposes
-- every row to anyone holding the anon key, independently of any application
-- code. But it was applied **by hand in the dashboard**, so the decision never
-- entered the repository. Every table created by a migration afterwards was
-- therefore born exposed: `ownership_period`, `saved_unit`, `saved_search` and
-- `area` were all flagged by Supabase's linter at ERROR level, and two of them
-- hold personal data — which homes a named person is watching, and the searches
-- they saved.
--
-- This does not break the application. It connects as the table owner, and an
-- owner bypasses RLS unless FORCE ROW LEVEL SECURITY is set; enabling it with
-- no policies closes the public REST surface and nothing else. It remains a
-- closed door rather than a lock — whether the 🔒 tables in doc 12 should also
-- carry real policies is left open in Q44.
--
-- Written as a loop so it covers the tables that exist now and stays correct
-- when it is replayed onto a fresh database, and so nobody has to maintain a
-- list. ENABLE is idempotent, so re-running is a no-op.

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
