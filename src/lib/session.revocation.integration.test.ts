import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db, resetDb, createIdentity } from '@/test/util';
import { createSessionToken, SESSION_COOKIE_NAME } from '@/modules/auth';
import { revokeAllSessions } from '@/modules/core';
import crypto from 'node:crypto';

// react's request-scoped cache() only exists in the server build; here it is a pass-through.
vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<typeof import('react')>()), cache: <T>(fn: T) => fn }));

let cookieValue: string | undefined;
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (name === SESSION_COOKIE_NAME && cookieValue ? { value: cookieValue } : undefined) }),
}));

import { getSessionUser } from './session';

describe('revocable sessions', () => {
  beforeEach(async () => {
    await resetDb();
    cookieValue = undefined;
  });

  it.each(['v1', 'v2'])('accepts legacy %s only before any revocation', async (version) => {
    const me = await createIdentity();
    const issuedAt = Date.now() + 60_000;
    const expiresAt = issuedAt + 30 * 24 * 60 * 60 * 1000;
    const payload = version === 'v1' ? `${me.id}.${expiresAt}` : `${me.id}.${issuedAt}.${expiresAt}`;
    const signature = crypto.createHmac('sha256', process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET || 'dev-only-insecure-session-secret').update(payload).digest('base64url');
    cookieValue = `${version}.${payload}.${signature}`;
    expect((await getSessionUser())?.identityId).toBe(me.id);
    await revokeAllSessions(db, me.id);
    // Even a later apparent issue time cannot grant a missing generation.
    expect(await getSessionUser()).toBeNull();
  });

  it('refuses a session issued before the cut-off, accepts one issued after, and leaves other identities alone', async () => {
    const me = await createIdentity();
    const other = await createIdentity();

    const old = createSessionToken(me.id, null);
    const othersToken = createSessionToken(other.id, null);
    cookieValue = old;
    expect((await getSessionUser())?.identityId).toBe(me.id);

    await revokeAllSessions(db, me.id);

    cookieValue = old;
    expect(await getSessionUser()).toBeNull();

    const current = await db.identity.findUniqueOrThrow({ where: { id: me.id } });
    cookieValue = createSessionToken(me.id, current.sessionsValidFrom!.getTime());
    expect((await getSessionUser())?.identityId).toBe(me.id);

    cookieValue = othersToken;
    expect((await getSessionUser())?.identityId).toBe(other.id);

    const audit = await db.auditLog.findMany({ where: { action: 'account:revoke_sessions', entityId: me.id } });
    expect(audit).toHaveLength(1);
  });
});
