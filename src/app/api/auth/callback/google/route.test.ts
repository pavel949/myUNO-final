import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    identity: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    authAccount: {
      upsert: vi.fn(),
    },
  },
}));

vi.mock('@/modules/auth', () => ({
  createSessionToken: vi.fn(() => 'signed-session-token'),
  sessionCookieOptions: vi.fn(() => ({
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 3600,
  })),
  SESSION_COOKIE_NAME: 'auth-session',
}));

import { GET } from './route';

describe('GET /api/auth/callback/google', () => {
  it('redirects missing code to /login with explicit error', async () => {
    const request = new NextRequest('http://localhost/api/auth/callback/google?state=x', {
      headers: { cookie: 'google_oauth_state=x' },
    });
    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/login?error=missing_authorization_code');
  });

  it('rejects callback when oauth state does not match cookie', async () => {
    const request = new NextRequest('http://localhost/api/auth/callback/google?code=abc&state=one', {
      headers: { cookie: 'google_oauth_state=two' },
    });
    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/login?error=invalid_oauth_state');
    expect(response.headers.get('set-cookie')).toContain('google_oauth_state=');
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
  });

  it('maps provider error to /login redirect', async () => {
    const request = new NextRequest(
      'http://localhost/api/auth/callback/google?error=access_denied&error_description=Denied'
    );
    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/login?error=Denied');
  });

  /**
   * The verified address is the entire linking mechanism.
   *
   * Below the userinfo call, an existing identity is matched on the Google
   * email alone, and the session that follows inherits that identity's
   * bookings and roles. If an unverified address were accepted, anyone able to
   * make Google emit a given address — a Workspace administrator setting a
   * primary address on their own domain, say — would sign in as that person.
   * The route once assumed "Google verifies emails before providing them",
   * which is not true: v2/userinfo returns `verified_email` precisely because
   * it can be false.
   */
  describe('the verified-email gate', () => {
    const identity = {
      id: 'identity-1',
      email: 'owner@example.com',
      status: 'active',
      firstName: 'Owner',
      lastName: 'Example',
    };

    function mockGoogle(verified: boolean | undefined) {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string | URL) => {
          const href = String(url);
          if (href.includes('oauth2.googleapis.com/token')) {
            return new Response(
              JSON.stringify({ access_token: 'at', id_token: 'it', expires_in: 3600 }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
          }
          if (href.includes('userinfo')) {
            return new Response(
              JSON.stringify({
                id: 'google-1',
                email: identity.email,
                ...(verified === undefined ? {} : { verified_email: verified }),
                name: 'Owner Example',
                given_name: 'Owner',
                family_name: 'Example',
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
          }
          throw new Error(`unexpected fetch: ${href}`);
        })
      );
    }

    function callback() {
      return GET(
        new NextRequest('http://localhost/api/auth/callback/google?code=abc&state=s', {
          headers: { cookie: 'google_oauth_state=s' },
        })
      );
    }

    beforeEach(async () => {
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.identity.findUnique).mockResolvedValue(identity as never);
      vi.mocked(prisma.authAccount.upsert).mockResolvedValue({} as never);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.clearAllMocks();
    });

    it('refuses an unverified Google address rather than linking it', async () => {
      mockGoogle(false);
      const response = await callback();

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/login?error=');
      expect(response.headers.get('location')).toContain('unverified');
      // The session is the thing that must not be issued.
      expect(response.headers.get('set-cookie') ?? '').not.toContain('signed-session-token');
    });

    it('refuses when Google omits verified_email entirely', async () => {
      mockGoogle(undefined);
      const response = await callback();

      expect(response.headers.get('location')).toContain('unverified');
      expect(response.headers.get('set-cookie') ?? '').not.toContain('signed-session-token');
    });

    it('signs in a verified address into the matching identity', async () => {
      mockGoogle(true);
      const response = await callback();

      expect(response.headers.get('set-cookie')).toContain('signed-session-token');
    });
  });
});
