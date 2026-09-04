/**
 * Supabase's direct host (`db.<ref>.supabase.co`) is IPv6-only. Vercel
 * functions cannot reach it — Prisma fails with P1001 in about a second.
 *
 * Doc 15 §2.2: use the session pooler on port 5432, never the transaction
 * pooler on 6543. This rewrite is a safety net for a DATABASE_URL that was
 * pasted from the "direct" tab; it does not invent credentials.
 *
 * Localhost and any non-Supabase URL are left untouched.
 */

const DIRECT_HOST = /^db\.([a-z0-9]+)\.supabase\.co$/i;
/** This project's provisioned region (doc 15 §2.1). Override with DATABASE_POOLER_HOST. */
const DEFAULT_POOLER_HOST = 'aws-1-ap-south-1.pooler.supabase.com';

export function resolveDatabaseUrl(raw: string | undefined): string | undefined {
  if (!raw) return raw;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }

  const direct = url.hostname.match(DIRECT_HOST);
  if (direct) {
    const ref = direct[1];
    url.hostname = process.env.DATABASE_POOLER_HOST || DEFAULT_POOLER_HOST;
    url.port = '5432';
    if (!url.username || url.username === 'postgres') {
      url.username = `postgres.${ref}`;
    }
    if (!url.searchParams.has('sslmode')) {
      url.searchParams.set('sslmode', 'require');
    }
    url.searchParams.delete('pgbouncer');
    return url.toString();
  }

  const isPooler =
    url.hostname.endsWith('pooler.supabase.com') ||
    url.hostname.endsWith('.pooler.supabase.com');

  if (isPooler && url.port === '6543') {
    url.port = '5432';
    url.searchParams.delete('pgbouncer');
    return url.toString();
  }

  return raw;
}
