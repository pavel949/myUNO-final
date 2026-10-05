import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    identity: {
      findUnique: vi.fn(async () => ({
        id: 'identity-1',
        email: 'guest@example.com',
        status: 'active',
      })),
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

  it('returns a successful OAuth login to the interrupted booking review', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'access',
            id_token: 'id',
            expires_in: 3600,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'google-1',
            email: 'guest@example.com',
            name: 'Guest Example',
            given_name: 'Guest',
            family_name: 'Example',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

    const next = '/book/review?unitId=unit-1&startDate=2026-11-10&endDate=2026-11-17';
    const request = new NextRequest(
      'http://localhost/api/auth/callback/google?code=abc&state=state-1',
      {
        headers: {
          cookie: `google_oauth_state=state-1; google_oauth_next=${encodeURIComponent(next)}`,
        },
      }
    );

    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(`http://localhost${next}`);
    expect(response.headers.get('set-cookie')).toContain('google_oauth_next=');
    fetchMock.mockRestore();
  });

  it('ignores an unsafe OAuth return path', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'access',
            id_token: 'id',
            expires_in: 3600,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'google-1',
            email: 'guest@example.com',
            name: 'Guest Example',
            given_name: 'Guest',
            family_name: 'Example',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

    const request = new NextRequest(
      'http://localhost/api/auth/callback/google?code=abc&state=state-1',
      {
        headers: {
          cookie:
            'google_oauth_state=state-1; google_oauth_next=' +
            encodeURIComponent('//evil.example/path'),
        },
      }
    );

    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost/app');
    fetchMock.mockRestore();
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
