/**
 * Supabase's direct host (`db.<ref>.supabase.co`) is IPv6-only. Vercel
 * functions cannot reach it — Prisma fails with P1001 in about a second.
 *
 * Doc 15 §2.2: use the session pooler on port 5432, never the transaction
 * pooler on 6543. The pooler also requires username `postgres.<ref>` — a
 * plain `postgres` user is rejected even when the password is correct.
 *
 * This rewrite is a safety net for a DATABASE_URL pasted from the wrong
 * tab; it does not invent a password.
 *
 * Localhost and any non-Supabase URL are left untouched.
 */

const DIRECT_HOST = /^db\.([a-z0-9]+)\.supabase\.co$/i;
/** This project's provisioned region (doc 15 §2.1). Override with DATABASE_POOLER_HOST. */
const DEFAULT_POOLER_HOST = 'aws-1-ap-south-1.pooler.supabase.com';
/** This project's Supabase ref (doc 15 §2.1). Override with SUPABASE_PROJECT_REF. */
const DEFAULT_PROJECT_REF = 'burcnghheyzbzffzgmjz';

function projectRef(): string {
  return process.env.SUPABASE_PROJECT_REF || DEFAULT_PROJECT_REF;
}

function qualifyPoolerUsername(url: URL): boolean {
  if (!url.username || url.username === 'postgres') {
    url.username = `postgres.${projectRef()}`;
    return true;
  }
  return false;
}

function ensureSsl(url: URL): boolean {
  if (!url.searchParams.has('sslmode')) {
    url.searchParams.set('sslmode', 'require');
    return true;
  }
  return false;
}

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
    ensureSsl(url);
    url.searchParams.delete('pgbouncer');
    return url.toString();
  }

  const isPooler =
    url.hostname.endsWith('pooler.supabase.com') ||
    url.hostname.endsWith('.pooler.supabase.com');

  if (!isPooler) {
    return raw;
  }

  let changed = false;
  if (url.port === '6543') {
    url.port = '5432';
    url.searchParams.delete('pgbouncer');
    changed = true;
  }
  if (qualifyPoolerUsername(url)) changed = true;
  if (ensureSsl(url)) changed = true;
  return changed ? url.toString() : raw;
}
