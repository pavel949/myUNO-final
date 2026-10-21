import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from './middleware';

vi.mock('@/lib/observability', () => ({
  CORRELATION_ID_HEADER: 'x-correlation-id',
  newCorrelationId: () => 'test-correlation-id',
  sanitiseCorrelationId: () => null,
}));

afterEach(() => vi.unstubAllEnvs());

describe('direct image upload CSP boundary', () => {
  it.each(['production', 'development'])('allows only the documented Blob PUT path in %s', (environment) => {
    vi.stubEnv('NODE_ENV', environment);
    const response = middleware(new NextRequest('https://myuno.app/property/content'));
    const directives = response.headers.get('Content-Security-Policy')!.split('; ');
    expect(directives).toEqual([
      "default-src 'self'",
      environment === 'production'
        ? "script-src 'self' 'unsafe-inline'"
        : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self' https://tile.openstreetmap.org https://vercel.com/api/blob/",
      "worker-src 'self' blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ]);
    const connect = directives.find((directive) => directive.startsWith('connect-src '))!;
    expect(connect).not.toContain('*');
    expect(connect.split(' ')).not.toContain('https:');
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  });
});
