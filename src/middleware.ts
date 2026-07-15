import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Security headers middleware for T-042 hardening.
 * Applies CSP, HSTS, X-Frame-Options, and other protective headers to all responses.
 */
export function middleware(_request: NextRequest) {
  const response = NextResponse.next();

  // Content Security Policy — strict by default, public pages only
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      // Next.js App Router hydrates via inline <script> tags (self.__next_f),
      // so 'unsafe-inline' is required or all client interactivity is blocked.
      // Tightening to nonces needs Next's nonce plumbing — tracked for post-launch.
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'", // Tailwind needs inline styles
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')
  );

  // Prevent MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // Clickjacking protection
  response.headers.set('X-Frame-Options', 'DENY');

  // XSS protection (legacy, but still useful for older browsers)
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // HSTS (Strict-Transport-Security) — 1 year, includes subdomains
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  // Referrer policy — strict (no referrer to external sites)
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions policy (formerly Feature-Policy)
  response.headers.set(
    'Permissions-Policy',
    [
      'geolocation=()',
      'microphone=()',
      'camera=()',
      'payment=()',
      'usb=()',
      'magnetometer=()',
      'gyroscope=()',
      'accelerometer=()',
    ].join(', ')
  );

  return response;
}

// Apply middleware to all routes except static assets and api health checks
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
