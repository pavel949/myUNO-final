import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  CORRELATION_ID_HEADER,
  newCorrelationId,
  sanitiseCorrelationId,
} from '@/lib/observability';

/**
 * Security headers (T-042) and request correlation (P1-5).
 *
 * Every request gets an id here, before any handler runs, so a log line, an
 * error page and a support conversation can all name the same request. An
 * inbound id is honoured when it looks like one we issued — that keeps a trace
 * intact across an internal hop — and replaced otherwise, so a caller cannot
 * choose an id that forges log lines or injects header content.
 */
export function middleware(request: NextRequest) {
  const correlationId =
    sanitiseCorrelationId(request.headers.get(CORRELATION_ID_HEADER)) ?? newCorrelationId();

  // Forwarded on the request so handlers can read it, and echoed on the response
  // so the browser, the client and any proxy log see the same id.
  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.set(CORRELATION_ID_HEADER, correlationId);

  const response = NextResponse.next({ request: { headers: forwardedHeaders } });
  response.headers.set(CORRELATION_ID_HEADER, correlationId);

  // Content Security Policy — strict by default, public pages only
  //
  // In development, Next.js evaluates client modules and React Refresh through
  // eval(), so 'unsafe-eval' is required or the browser blocks the dev runtime
  // and no page ever hydrates (interactive forms silently fall back to a native
  // submit). It is added for development only — production keeps the strict CSP.
  const scriptSrc =
    process.env.NODE_ENV === 'production'
      ? "script-src 'self' 'unsafe-inline'"
      : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      // Next.js App Router hydrates via inline <script> tags (self.__next_f),
      // so 'unsafe-inline' is required or all client interactivity is blocked.
      // Tightening to nonces needs Next's nonce plumbing — tracked for post-launch.
      scriptSrc,
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
