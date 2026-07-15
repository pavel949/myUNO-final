/**
 * Rate limiting for auth endpoints (login/reset/claim).
 * Implements per-IP and per-account limits with exponential backoff.
 * Uses in-memory storage; swap for Redis on multi-instance deployments.
 */

type RateLimitKey = string;
interface RateLimitEntry {
  attempts: number;
  resetAt: number;
  backoffMultiplier: number;
}

const limiterStore = new Map<RateLimitKey, RateLimitEntry>();

interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
  backoffMs: number;
}

const authLimitConfig: RateLimitConfig = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
  backoffMs: 2 * 60 * 1000, // 2 minutes base for exponential backoff
};

/**
 * Check rate limit for a given key (e.g., "login:192.168.1.1" or "reset:user@example.com").
 * Returns { allowed: true } or { allowed: false, retryAfterMs: number }.
 */
export function checkRateLimit(
  key: RateLimitKey,
  config: RateLimitConfig = authLimitConfig
): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  let entry = limiterStore.get(key);

  if (!entry) {
    // First attempt
    limiterStore.set(key, {
      attempts: 1,
      resetAt: now + config.windowMs,
      backoffMultiplier: 1,
    });
    return { allowed: true };
  }

  // Check if window has expired
  if (now >= entry.resetAt) {
    // Window expired, reset counter
    limiterStore.set(key, {
      attempts: 1,
      resetAt: now + config.windowMs,
      backoffMultiplier: 1,
    });
    return { allowed: true };
  }

  // Within window: check if exceeded
  if (entry.attempts < config.maxAttempts) {
    entry.attempts++;
    limiterStore.set(key, entry);
    return { allowed: true };
  }

  // Exceeded: calculate exponential backoff
  const backoffMs =
    config.backoffMs * Math.pow(2, entry.backoffMultiplier - 1);
  const retryAfterMs = entry.resetAt - now + backoffMs;

  // Increment backoff multiplier for next failure
  entry.backoffMultiplier++;
  limiterStore.set(key, entry);

  return { allowed: false, retryAfterMs };
}

/**
 * Reset rate limit for a key (e.g., after successful login).
 */
export function resetRateLimit(key: RateLimitKey): void {
  limiterStore.delete(key);
}

/**
 * Get the current state (attempts, remaining time) for monitoring.
 */
export function getRateLimitStatus(key: RateLimitKey): {
  attempts: number;
  resetAtMs: number;
} | null {
  const entry = limiterStore.get(key);
  if (!entry) return null;
  return { attempts: entry.attempts, resetAtMs: entry.resetAt };
}
