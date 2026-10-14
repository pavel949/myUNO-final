import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({ initial: vi.fn(), current: vi.fn(), update: vi.fn(), rotate: vi.fn(), token: vi.fn(), query: vi.fn(), account: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: {
  identity: { findUnique: mocks.initial },
  authAccount: { upsert: mocks.account },
  $transaction: (work: (tx: unknown) => Promise<unknown>) => work({ $queryRaw: mocks.query, identity: { findUniqueOrThrow: mocks.current, update: mocks.update } }),
} }));
vi.mock('@/lib/session-generation', () => ({ advanceSessionGeneration: mocks.rotate }));
vi.mock('@/modules/auth', () => ({ createSessionToken: mocks.token, sessionCookieOptions: () => ({ path: '/' }), SESSION_COOKIE_NAME: 'auth-session' }));
import { GET } from './route';

describe('Google recovery uses the current locked credential state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.token.mockReturnValue('signed-test-token');
    mocks.query.mockResolvedValue([{ id: 'owner' }]);
    mocks.account.mockResolvedValue({});
  });

  it('does not erase a password reset after the first lookup', async () => {
    const snapshot = { id: 'owner', email: 'owner@example.test', status: 'active', hashedPassword: 'unproved-old-hash', emailVerifiedAt: null, sessionsValidFrom: null };
    const recovered = { ...snapshot, hashedPassword: 'recovered-hash', emailVerifiedAt: new Date(), sessionsValidFrom: new Date(123456789) };
    mocks.initial.mockResolvedValue(snapshot);
    mocks.current.mockResolvedValue(recovered);
    const fetch = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'test-token' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'google-owner', email: 'owner@example.test', verified_email: true }), { status: 200 }));
    try {
      const response = await GET(new NextRequest('http://localhost/api/auth/callback/google?code=test&state=state', { headers: { cookie: 'google_oauth_state=state' } }));
      expect(response.status).toBe(307);
      expect(response.cookies.get('auth-session')?.value).toBe('signed-test-token');
      expect(mocks.update).not.toHaveBeenCalled();
      expect(mocks.rotate).not.toHaveBeenCalled();
      expect(mocks.token).toHaveBeenCalledWith('owner', 123456789);
    } finally { fetch.mockRestore(); }
  });
});
