-- Supabase role compatibility for plain PostgreSQL environments.
--
-- WHY THIS EXISTS
--
-- Production runs on Supabase, which ships three roles that plain PostgreSQL
-- does not have: `anon`, `authenticated` and `service_role`. Supabase also sets
-- default privileges granting new public tables to them, which is how the Data
-- API exposes a table the moment it is created.
--
-- Two consequences follow, and both are load-bearing:
--
--   1. `20260912000000_secure_canonical_v3_operational_tables` REVOKEs those
--      grants for the canonical v3 operational tables. On a database without
--      the roles that statement aborts with `role "anon" does not exist`,
--      which is why the migration chain could not replay in CI, could not be
--      provisioned from scratch, and could not be restored into a scratch
--      database for a backup drill.
--   2. A `pg_dump` of production carries GRANT statements naming these roles,
--      so a restore into plain PostgreSQL needs them present regardless of
--      anything the migration chain does.
--
-- Because (2) is true independently, the environment — not the migration — is
-- the right place to solve this. The already-applied migration is left exactly
-- as production ran it.
--
-- WHY IT GRANTS BEFORE IT REVOKES
--
-- This deliberately reproduces Supabase's default-privilege behaviour rather
-- than only creating empty roles. If the roles existed with no privileges, the
-- REVOKE would be a no-op and CI would prove nothing about the security
-- posture it is supposed to be enforcing. Granting first means the REVOKE
-- actually removes something, and `db:verify` can assert that it did.
--
-- These roles are NOLOGIN: they exist to be the subject of GRANT/REVOKE, never
-- to be connected as. This file is for test, CI and scratch databases. It is
-- never applied to production, where Supabase already owns these roles.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Mirror Supabase: tables created from here on are exposed by default, so the
-- security migration has something real to close.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
