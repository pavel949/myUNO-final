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

function mockGoogleExchange(userInfo: Record<string, unknown>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.includes('oauth2.googleapis.com/token')) {
        return {
          ok: true,
          json: async () => ({ access_token: 'tok', id_token: 'idtok', expires_in: 3600 }),
        } as Response;
      }
      if (url.includes('userinfo')) {
        return { ok: true, json: async () => userInfo } as Response;
      }
      throw new Error(`unexpected fetch: ${url}`);
    })
  );
}

async function callbackRequest() {
  return new NextRequest('http://localhost/api/auth/callback/google?code=abc&state=x', {
    headers: { cookie: 'google_oauth_state=x' },
  });
}

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

  it('refuses a Google account whose email is not verified — the link mechanism depends on it', async () => {
    mockGoogleExchange({ id: 'g1', email: 'anna@example.com', verified_email: false, name: 'Anna' });

    const response = await GET(await callbackRequest());

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/login?error=');
    expect(prisma.identity.findUnique).not.toHaveBeenCalled();
  });

  it('signs in an existing identity found by verified email, inheriting its bookings and roles', async () => {
    mockGoogleExchange({ id: 'g1', email: 'anna@example.com', verified_email: true, name: 'Anna Sokolova' });
    vi.mocked(prisma.identity.findUnique).mockResolvedValue({
      id: 'identity-1',
      status: 'active',
    } as any);

    const response = await GET(await callbackRequest());

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/app');
    expect(prisma.identity.create).not.toHaveBeenCalled();
    expect(prisma.authAccount.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ identityId: 'identity-1' }) })
    );
  });

  it('creates a new identity exactly as the email path would when the verified address is new', async () => {
    mockGoogleExchange({ id: 'g2', email: 'new@example.com', verified_email: true, name: 'New Guest' });
    vi.mocked(prisma.identity.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.identity.create).mockResolvedValue({ id: 'identity-2', status: 'active' } as any);

    const response = await GET(await callbackRequest());

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/app');
    expect(prisma.identity.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ email: 'new@example.com' }) })
    );
  });
});
