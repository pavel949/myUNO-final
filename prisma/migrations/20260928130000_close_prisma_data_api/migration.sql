-- The Next.js/Prisma application does not use the Supabase Data API.
-- Keep all application tables unreachable by anon/authenticated even if a
-- future migration accidentally omits ENABLE ROW LEVEL SECURITY.
-- Service-role grants and the server-side Prisma connection are unchanged.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
