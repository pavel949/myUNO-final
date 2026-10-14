/**
 * Rate limiting for auth endpoints and public write endpoints.
 *
 * Counters live in Postgres (`rate_limit_bucket`) so every serverless instance
 * shares one count — a per-instance memory map let an attacker spread attempts
 * across instances and multiply the budget. One atomic upsert per check; time is
 * the database's, so instances with skewed clocks agree.
 *
 * If the shared counter is unavailable, refuse the attempt. Per-instance memory
 * cannot preserve the shared budget during a schema, permission or database failure.
 */
import { createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';

type RateLimitKey = string;

/**
 * What is actually stored: a hash of the caller's key. Keys carry IP addresses and
 * e-mail addresses (personal data under PDPA), so the table never holds them in
 * readable form; the hash also fixes the length, so an oversized input cannot make
 * the insert fail and silently drop the limiter back to per-instance memory.
 */
export function rateLimitBucketKey(key: RateLimitKey): string {
  return createHash('sha256').update(key).digest('hex');
}

export interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
  backoffMs: number;
}

const authLimitConfig: RateLimitConfig = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
  backoffMs: 2 * 60 * 1000, // 2 minutes base for exponential backoff
};

/** Shared-IP budget for password attempts: generous, because it is only a flood brake — the per-account limit is the strict one. */
export const loginIpLimitConfig: RateLimitConfig = {
  maxAttempts: 20,
  windowMs: 15 * 60 * 1000,
  backoffMs: 2 * 60 * 1000,
};

type Result = { allowed: boolean; retryAfterMs?: number };

// ---- Shared counters ----

/** Rows past their window are dead weight; sweep a day-old tail on roughly 1 call in 50. */
const SWEEP_PROBABILITY = 0.02;

/**
 * Check rate limit for a given key (e.g. "login:ip:1.2.3.4" or "reset:acct:user@example.com").
 * Returns { allowed: true } or { allowed: false, retryAfterMs }.
 */
export async function checkRateLimit(
  rawKey: RateLimitKey,
  config: RateLimitConfig = authLimitConfig
): Promise<Result> {
  const key = rateLimitBucketKey(rawKey);
  try {
    const rows = await prisma.$queryRaw<
      { attempts: number; remaining_ms: number; backoff: number }[]
    >`
      INSERT INTO rate_limit_bucket AS b ("key", attempts, reset_at, backoff_multiplier)
      VALUES (${key}, 1, now() + (${config.windowMs}::double precision * interval '1 millisecond'), 1)
      ON CONFLICT ("key") DO UPDATE SET
        attempts = CASE WHEN b.reset_at <= now() THEN 1 ELSE b.attempts + 1 END,
        backoff_multiplier = CASE WHEN b.reset_at <= now() THEN 1 ELSE b.backoff_multiplier END,
        reset_at = CASE WHEN b.reset_at <= now()
          THEN now() + (${config.windowMs}::double precision * interval '1 millisecond')
          ELSE b.reset_at END
      RETURNING b.attempts AS attempts,
        (extract(epoch FROM (b.reset_at - now())) * 1000)::double precision AS remaining_ms,
        b.backoff_multiplier AS backoff`;
    const row = rows[0];

    if (Math.random() < SWEEP_PROBABILITY) {
      void prisma.$executeRaw`DELETE FROM rate_limit_bucket WHERE reset_at < now() - interval '1 day'`.catch(() => null);
    }

    if (row.attempts <= config.maxAttempts) return { allowed: true };

    const backoffMs = config.backoffMs * Math.pow(2, Math.min(row.backoff - 1, 10));
    // A bookkeeping failure must never turn an established denial into an allowance.
    await prisma.$executeRaw`UPDATE rate_limit_bucket SET backoff_multiplier = backoff_multiplier + 1 WHERE "key" = ${key}`.catch(() => null);
    return { allowed: false, retryAfterMs: Math.max(0, Math.round(row.remaining_ms)) + backoffMs };
  } catch {
    // Do not include the error: driver messages can contain connection details.
    console.error('Shared rate limiter unavailable; request refused');
    return { allowed: false, retryAfterMs: 60_000 };
  }
}

/** Reset rate limit for a key (e.g. after a successful login). */
export async function resetRateLimit(rawKey: RateLimitKey): Promise<void> {
  const key = rateLimitBucketKey(rawKey);
  await prisma.$executeRaw`DELETE FROM rate_limit_bucket WHERE "key" = ${key}`.catch(() => null);
}

/**
 * Give one attempt back — a successful login must not count against the
 * shared-IP budget (an office, a hotel desk or a mobile carrier puts many
 * real people behind one address). Failures keep their count.
 */
export async function refundRateLimit(rawKey: RateLimitKey): Promise<void> {
  const key = rateLimitBucketKey(rawKey);
  await prisma.$executeRaw`UPDATE rate_limit_bucket SET attempts = GREATEST(attempts - 1, 0) WHERE "key" = ${key}`.catch(() => null);
}
