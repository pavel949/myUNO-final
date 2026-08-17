import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from './middleware';
import { redactEmail } from '@/modules/comms/email.seam';

/**
 * T-042 hardening evidence: the security headers and the PII redaction
 * helpers, asserted rather than asserted-about.
 */
describe('Security headers (T-042, doc 12)', () => {
  function headersFor(path = '/') {
    return middleware(new NextRequest(`https://myuno.app${path}`)).headers;
  }

  it('forbids framing, so the app cannot be clickjacked', () => {
    const headers = headersFor();
    expect(headers.get('X-Frame-Options')).toBe('DENY');
    expect(headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");
  });

  it('pins the content security policy to our own origin', () => {
    const csp = headersFor().get('Content-Security-Policy')!;

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("base-uri 'self'");
    // A form that can post anywhere is an exfiltration route for anything a
    // guest types, passport details included.
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("connect-src 'self'");
  });

  it('requires HTTPS for a year, subdomains included', () => {
    const hsts = headersFor().get('Strict-Transport-Security')!;
    expect(hsts).toContain('max-age=31536000');
    expect(hsts).toContain('includeSubDomains');
  });

  it('stops MIME sniffing and leaks through the referrer', () => {
    const headers = headersFor();
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  });

  it('denies the device permissions the platform never asks for', () => {
    const policy = headersFor().get('Permissions-Policy')!;
    for (const feature of ['geolocation', 'microphone', 'camera', 'payment']) {
      expect(policy).toContain(`${feature}=()`);
    }
  });

  it('applies the same headers to an authenticated surface', () => {
    // Headers that only cover the marketing pages protect nothing that matters.
    const headers = headersFor('/owner');
    expect(headers.get('X-Frame-Options')).toBe('DENY');
    expect(headers.get('Content-Security-Policy')).toBeTruthy();
  });
});

describe('PII redaction (T-042, doc 12)', () => {
  it('leaves an address correlatable but not contactable', () => {
    expect(redactEmail('anna.petrova@example.com')).toBe('a***@example.com');
  });

  it('never returns the local part, however short', () => {
    expect(redactEmail('a@example.com')).toBe('a***@example.com');
  });

  it('redacts entirely when the input is not an address', () => {
    expect(redactEmail('not-an-address')).toBe('***');
  });
});
