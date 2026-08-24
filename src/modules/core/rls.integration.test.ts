import { describe, it, expect } from 'vitest';
import { db } from '@/test/util';

/**
 * Every table must have row-level security enabled.
 *
 * The hosted database sits behind Supabase's PostgREST endpoint, which serves
 * any table in `public` to anyone holding the anon key — a key that ships to
 * browsers. RLS off means the rows are readable, whatever the application code
 * says. Doc 15 §2.3 records this being fixed across the database in August 2026,
 * **by hand in the dashboard**, so the decision never entered the repository.
 *
 * Four tables created by migrations afterwards were therefore born exposed, and
 * Supabase's own linter flagged them at ERROR level months later: two of them
 * hold personal data — which homes a named person is watching, and the searches
 * they saved. Nothing in the build noticed.
 *
 * This test is what notices. It runs against the test database, which is built
 * from the same migrations as production, so a new table without RLS fails here
 * long before it reaches a live endpoint.
 */
describe('the hosted database cannot leak a table through its REST endpoint', () => {
  it('has row-level security on every table', async () => {
    const unprotected = await db.$queryRaw<{ tablename: string }[]>`
      SELECT c.relname AS tablename
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND NOT c.relrowsecurity
      ORDER BY c.relname
    `;

    expect(
      unprotected.map((t) => t.tablename),
      'these tables are readable through the public REST endpoint; add them to an ENABLE ROW LEVEL SECURITY migration'
    ).toEqual([]);
  });
});
