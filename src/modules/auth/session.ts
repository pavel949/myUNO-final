import crypto from 'crypto';

/**
 * Signed sessions bind to the identity generation that was actually authenticated.
 * v3.<id>.<generation-or-none>.<issuedAtMs>.<expiresAtMs>.<signature>
 *
 * Generation comes from the authenticated identity snapshot, never from a later
 * lookup after password verification. A concurrent recovery therefore invalidates
 * an in-flight old-credential login even if its response is sent afterwards.
 * Legacy v1/v2 signatures still verify; session resolution accepts them only while
 * sessionsValidFrom is null. A prior revocation requires signing in again.
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

export function createSessionToken(
  identityId: string,
  generation: number | null,
  ttlMs: number = SESSION_TTL_MS,
): string {
  if (generation !== null && (!Number.isSafeInteger(generation) || generation < 0)) {
    throw new Error('A valid session generation is required');
  }
  const issuedAtMs = Date.now();
  const expiresAtMs = issuedAtMs + ttlMs;
  const payload = `v3.${identityId}.${generation === null ? 'none' : generation}.${issuedAtMs}.${expiresAtMs}`;
  return `${payload}.${sign(payload)}`;
}

export interface VerifiedSession {
  identityId: string;
  issuedAtMs: number;
  /** Undefined only for a legacy v1/v2 token. Null is the initial generation. */
  generation?: number | null;
}

function constantTimeEqual(signature: string, expected: string): boolean {
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function validTime(value: string): boolean {
  return /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) >= 0;
}

export function verifySessionToken(token: string): VerifiedSession | null {
  const parts = token.split('.');

  if (parts.length === 6 && parts[0] === 'v3') {
    const [, identityId, generation, issuedAt, expiresAt, signature] = parts;
    if (!identityId || !signature || !validTime(issuedAt) || !validTime(expiresAt)) return null;
    if (generation !== 'none' && !validTime(generation)) return null;
    if (!constantTimeEqual(signature, sign(parts.slice(0, 5).join('.')))) return null;
    if (Number(expiresAt) <= Date.now() || Number(expiresAt) <= Number(issuedAt)) return null;
    return { identityId, issuedAtMs: Number(issuedAt), generation: generation === 'none' ? null : Number(generation) };
  }

  if (parts.length === 5 && parts[0] === 'v2') {
    const [, identityId, issuedAt, expiresAt, signature] = parts;
    if (!identityId || !signature || !validTime(issuedAt) || !validTime(expiresAt)) return null;
    if (!constantTimeEqual(signature, sign(`${identityId}.${issuedAt}.${expiresAt}`))) return null;
    if (Number(expiresAt) <= Date.now() || Number(expiresAt) <= Number(issuedAt)) return null;
    return { identityId, issuedAtMs: Number(issuedAt) };
  }

  if (parts.length === 4 && parts[0] === 'v1') {
    const [, identityId, expiresAt, signature] = parts;
    if (!identityId || !signature || !validTime(expiresAt)) return null;
    if (!constantTimeEqual(signature, sign(`${identityId}.${expiresAt}`))) return null;
    if (Number(expiresAt) <= Date.now()) return null;
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
