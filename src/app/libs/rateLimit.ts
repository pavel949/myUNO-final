/**
 * Rate limiting for auth endpoints and public write endpoints.
 *
 * Counters live in Postgres (`rate_limit_bucket`) so every serverless instance
 * shares one count — a per-instance memory map let an attacker spread attempts
 * across instances and multiply the budget. One atomic upsert per check; time is
 * the database's, so instances with skewed clocks agree.
 *
 * If the database cannot be reached the limiter falls back to this instance's
 * memory rather than blocking sign-in (the database being down is already the
 * bigger problem, and failing closed would lock every guest out).
 */
import { prisma } from '@/lib/prisma';

type RateLimitKey = string;

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

// ---- Fallback: per-instance memory (only used while the database is unreachable) ----

interface MemoryEntry {
  attempts: number;
  resetAt: number;
  backoffMultiplier: number;
}
const memoryStore = new Map<RateLimitKey, MemoryEntry>();

function memoryCheck(key: RateLimitKey, config: RateLimitConfig): Result {
  const now = Date.now();
  const entry = memoryStore.get(key);
  if (!entry || now >= entry.resetAt) {
    memoryStore.set(key, { attempts: 1, resetAt: now + config.windowMs, backoffMultiplier: 1 });
    return { allowed: true };
  }
  if (entry.attempts < config.maxAttempts) {
    entry.attempts++;
    return { allowed: true };
  }
  const backoffMs = config.backoffMs * Math.pow(2, Math.min(entry.backoffMultiplier - 1, 10));
  entry.backoffMultiplier++;
  return { allowed: false, retryAfterMs: entry.resetAt - now + backoffMs };
}

// ---- Shared counters ----

/** Rows past their window are dead weight; sweep a day-old tail on roughly 1 call in 50. */
const SWEEP_PROBABILITY = 0.02;

/**
 * Check rate limit for a given key (e.g. "login:ip:1.2.3.4" or "reset:acct:user@example.com").
 * Returns { allowed: true } or { allowed: false, retryAfterMs }.
 */
export async function checkRateLimit(
  key: RateLimitKey,
  config: RateLimitConfig = authLimitConfig
): Promise<Result> {
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
    await prisma.$executeRaw`UPDATE rate_limit_bucket SET backoff_multiplier = backoff_multiplier + 1 WHERE "key" = ${key}`;
    return { allowed: false, retryAfterMs: Math.max(0, Math.round(row.remaining_ms)) + backoffMs };
  } catch {
    return memoryCheck(key, config);
  }
}

/** Reset rate limit for a key (e.g. after a successful login). */
export async function resetRateLimit(key: RateLimitKey): Promise<void> {
  memoryStore.delete(key);
  await prisma.$executeRaw`DELETE FROM rate_limit_bucket WHERE "key" = ${key}`.catch(() => null);
}

/**
 * Give one attempt back — a successful login must not count against the
 * shared-IP budget (an office, a hotel desk or a mobile carrier puts many
 * real people behind one address). Failures keep their count.
 */
export async function refundRateLimit(key: RateLimitKey): Promise<void> {
  const entry = memoryStore.get(key);
  if (entry && entry.attempts > 0) entry.attempts--;
  await prisma.$executeRaw`UPDATE rate_limit_bucket SET attempts = GREATEST(attempts - 1, 0) WHERE "key" = ${key}`.catch(() => null);
}
