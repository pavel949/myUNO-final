import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db, resetDb, createIdentity } from '@/test/util';
import { createSessionToken, SESSION_COOKIE_NAME } from '@/modules/auth';
import { revokeAllSessions } from '@/modules/core';

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

  it('refuses a session issued before the cut-off, accepts one issued after, and leaves other identities alone', async () => {
    const me = await createIdentity();
    const other = await createIdentity();

    const old = createSessionToken(me.id);
    const othersToken = createSessionToken(other.id);
    cookieValue = old;
    expect((await getSessionUser())?.identityId).toBe(me.id);

    await new Promise((resolve) => setTimeout(resolve, 5));
    await revokeAllSessions(db, me.id);

    cookieValue = old;
    expect(await getSessionUser()).toBeNull();

    await new Promise((resolve) => setTimeout(resolve, 5));
    cookieValue = createSessionToken(me.id);
    expect((await getSessionUser())?.identityId).toBe(me.id);

    cookieValue = othersToken;
    expect((await getSessionUser())?.identityId).toBe(other.id);

    const audit = await db.auditLog.findMany({ where: { action: 'account:revoke_sessions', entityId: me.id } });
    expect(audit).toHaveLength(1);
  });
});
