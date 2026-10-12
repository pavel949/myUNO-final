import { describe, expect, it, vi } from 'vitest';
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
import { prisma } from '@/lib/prisma';
import { createSessionToken } from '@/modules/auth';

describe('GET /api/auth/callback/google', () => {
  it.each([false, undefined])('rejects unverified Google email (%s) before account linking', async (verified_email) => {
    vi.clearAllMocks();
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'test-token' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 'google-account', email: 'person@example.test', verified_email,
        name: 'Person Example', given_name: 'Person', family_name: 'Example',
      }), { status: 200 }));
    try {
      const request = new NextRequest('http://localhost/api/auth/callback/google?code=valid&state=nonce', {
        headers: { cookie: 'google_oauth_state=nonce' },
      });
      const response = await GET(request);
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('unverified_google_email');
      expect(prisma.identity.findUnique).not.toHaveBeenCalled();
      expect(prisma.identity.create).not.toHaveBeenCalled();
      expect(prisma.authAccount.upsert).not.toHaveBeenCalled();
      expect(createSessionToken).not.toHaveBeenCalled();
      expect(response.cookies.get('auth-session')).toBeUndefined();
    } finally {
      fetchMock.mockRestore();
    }
  });

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
});
