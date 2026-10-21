/** Explicit production review policy. No client text, secrets or DB errors leave this module. */
import { resolveDatabaseUrl } from '../src/lib/resolveDatabaseUrl.ts';

/** The build gate must reach the registry through the same route as the running app (src/lib/prisma.ts). */
export function contentGateDatabaseUrl(env) {
  return resolveDatabaseUrl(env.DATABASE_URL);
}

export function isolatedContentBuild(env) {
  if (env.VERCEL_ENV || env.VERCEL_TARGET_ENV) return false;
  if (env.CI !== 'true' && env.MYUNO_BROWSER_ACCEPTANCE !== 'isolated') return false;
  if (!env.DATABASE_URL || env.DATABASE_URL !== env.DATABASE_URL_TEST) return false;
  try {
    const url = new URL(env.DATABASE_URL);
    return ['postgres:', 'postgresql:'].includes(url.protocol) &&
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && /(?:^|_)test(?:_|$)/.test(url.pathname.slice(1));
  } catch { return false; }
}

export async function evaluateContentReviewGate(env, db) {
  const production = env.NODE_ENV === 'production' || env.VERCEL_ENV === 'production' || env.VERCEL_TARGET_ENV === 'production';
  if (env.CONTENT_REVIEW_GATE_ENABLED === 'false') {
    if (!production || isolatedContentBuild(env)) return { passed: true, state: 'explicit_isolated_or_development_bypass' };
    return { passed: false, state: 'production_bypass_refused' };
  }
  if (!env.DATABASE_URL) return { passed: !production, state: 'database_missing' };
  try {
    const pending = await db.translation.count({ where: { status: 'needs_review' } });
    if (!Number.isSafeInteger(pending) || pending < 0) return { passed: false, state: 'invalid_review_count' };
    return { passed: pending === 0 || !production, state: pending ? 'review_pending' : 'reviewed', pending };
  } catch {
    return { passed: !production, state: 'database_unavailable' };
  }
}
