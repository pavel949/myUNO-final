import crypto from 'crypto';

/**
 * Signed session tokens.
 *
 * Format: `v1.<identityId>.<expiresAtMs>.<signature>`
 * Signature: HMAC-SHA256 over `<identityId>.<expiresAtMs>` with SESSION_SECRET.
 *
 * The cookie value is opaque to the client and tamper-evident: changing the
 * identity id or expiry invalidates the signature. No DB round-trip is needed
 * to verify; the identity row is still checked (exists, not blocked) by the
 * caller.
 */

export const SESSION_COOKIE_NAME = 'auth-session';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SESSION_SECRET is required in production');
    }
    return 'dev-only-insecure-session-secret';
  }
  return secret;
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', getSessionSecret()).update(payload).digest('base64url');
}

export function createSessionToken(identityId: string, ttlMs: number = SESSION_TTL_MS): string {
  const expiresAtMs = Date.now() + ttlMs;
  const payload = `${identityId}.${expiresAtMs}`;
  return `v1.${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string): { identityId: string } | null {
  const parts = token.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    return null;
  }
  const [, identityId, expiresAtMs, signature] = parts;
  if (!identityId || !expiresAtMs || !signature) {
    return null;
  }

  const expected = sign(`${identityId}.${expiresAtMs}`);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }

  if (Number(expiresAtMs) < Date.now()) {
    return null;
  }

  return { identityId };
}

/** Cookie attributes shared by login/register/logout routes. */
export function sessionCookieOptions(maxAgeSeconds: number = SESSION_TTL_MS / 1000) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
  };
}
