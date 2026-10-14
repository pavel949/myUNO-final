import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { hash } from 'bcryptjs';
import { db, resetDb } from '@/test/util';
import { GET } from './route';

const STATE = 'state-123';

function callback() {
  return GET(
    new NextRequest(`http://localhost/api/auth/callback/google?code=abc&state=${STATE}`, {
      headers: { cookie: `google_oauth_state=${STATE}` },
    })
  );
}

function googleReturns(user: { id: string; email: string; verified_email: boolean }) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) =>
      url.includes('oauth2.googleapis.com')
        ? new Response(JSON.stringify({ access_token: 't', id_token: 'i', expires_in: 3600 }), { status: 200 })
        : new Response(JSON.stringify({ ...user, name: 'Real Owner', given_name: 'Real', family_name: 'Owner' }), { status: 200 })
    )
  );
}

describe('Google sign-in vs. a pre-registered, unverified account', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('verifies the address, drops the unproven password and ends sessions opened on it', async () => {
    const attacker = await db.identity.create({
      data: { firstName: 'A', lastName: 'B', email: 'victim@example.com', hashedPassword: await hash('attacker-pass-1', 4), status: 'active' },
    });
    googleReturns({ id: 'g-1', email: 'victim@example.com', verified_email: true });

    const res = await callback();
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);

    const after = await db.identity.findUniqueOrThrow({ where: { id: attacker.id } });
    expect(after.hashedPassword).toBeNull();
    expect(after.emailVerifiedAt).not.toBeNull();
    expect(after.sessionsValidFrom).not.toBeNull();
    expect(await db.authAccount.count({ where: { identityId: attacker.id, provider: 'google' } })).toBe(1);
  });

  it('keeps the password of an account whose address was already verified', async () => {
    const owner = await db.identity.create({
      data: { firstName: 'O', lastName: 'W', email: 'owner@example.com', hashedPassword: await hash('owner-pass-1', 4), emailVerifiedAt: new Date(), status: 'active' },
    });
    googleReturns({ id: 'g-2', email: 'owner@example.com', verified_email: true });

    await callback();

    const after = await db.identity.findUniqueOrThrow({ where: { id: owner.id } });
    expect(after.hashedPassword).not.toBeNull();
    expect(after.sessionsValidFrom).toBeNull();
  });
});
