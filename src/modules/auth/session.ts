import crypto from 'crypto';

/**
 * Signed session tokens.
 *
 * Format: `v2.<identityId>.<issuedAtMs>.<expiresAtMs>.<signature>`
 * Signature: HMAC-SHA256 over `<identityId>.<issuedAtMs>.<expiresAtMs>` with SESSION_SECRET.
 *
 * `issuedAtMs` is what makes sessions revocable without a session table: an
 * identity carries `sessionsValidFrom`, and any token issued before it is
 * refused (see `lib/session.ts`). Legacy `v1.<id>.<expiresAtMs>.<sig>` cookies
 * still verify so nobody is signed out by the rollout; their issue time is
 * derived from the standard TTL, which can only make them look *older*, i.e.
 * the safe side of a revocation.
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
  const issuedAtMs = Date.now();
  const expiresAtMs = issuedAtMs + ttlMs;
  const payload = `${identityId}.${issuedAtMs}.${expiresAtMs}`;
  return `v2.${payload}.${sign(payload)}`;
}

export interface VerifiedSession {
  identityId: string;
  /** When the token was issued; compared with the identity's `sessionsValidFrom`. */
  issuedAtMs: number;
}

function constantTimeEqual(signature: string, expected: string): boolean {
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function verifySessionToken(token: string): VerifiedSession | null {
  const parts = token.split('.');

  if (parts.length === 5 && parts[0] === 'v2') {
    const [, identityId, issuedAt, expiresAt, signature] = parts;
    if (!identityId || !issuedAt || !expiresAt || !signature) return null;
    if (!constantTimeEqual(signature, sign(`${identityId}.${issuedAt}.${expiresAt}`))) return null;
    if (Number(expiresAt) < Date.now()) return null;
    return { identityId, issuedAtMs: Number(issuedAt) };
  }

  if (parts.length === 4 && parts[0] === 'v1') {
    const [, identityId, expiresAt, signature] = parts;
    if (!identityId || !expiresAt || !signature) return null;
    if (!constantTimeEqual(signature, sign(`${identityId}.${expiresAt}`))) return null;
    if (Number(expiresAt) < Date.now()) return null;
    return { identityId, issuedAtMs: Number(expiresAt) - SESSION_TTL_MS };
  }

  return null;
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
