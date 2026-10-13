import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { createSessionToken, verifySessionToken, SESSION_TTL_MS } from './session';

describe('session tokens', () => {
  it('round-trips a valid token', () => {
    const token = createSessionToken('identity-123');
    const session = verifySessionToken(token);
    expect(session?.identityId).toBe('identity-123');
    expect(session?.issuedAtMs).toBeLessThanOrEqual(Date.now());
    expect(session?.issuedAtMs).toBeGreaterThan(Date.now() - 5000);
  });

  it('rejects a tampered identity id', () => {
    const token = createSessionToken('identity-123');
    const [v, , iat, expiry, sig] = token.split('.');
    const tampered = `${v}.identity-456.${iat}.${expiry}.${sig}`;
    expect(verifySessionToken(tampered)).toBeNull();
  });

  it('rejects a tampered expiry', () => {
    const token = createSessionToken('identity-123');
    const [v, id, iat, , sig] = token.split('.');
    const tampered = `${v}.${id}.${iat}.${Date.now() + 999999999}.${sig}`;
    expect(verifySessionToken(tampered)).toBeNull();
  });

  it('rejects an expired token', () => {
    const token = createSessionToken('identity-123', -1000);
    expect(verifySessionToken(token)).toBeNull();
  });

  it('rejects a tampered issue time (it is signed, so a token cannot be made to look newer)', () => {
    const token = createSessionToken('identity-123');
    const [v, id, , expiry, sig] = token.split('.');
    expect(verifySessionToken(`${v}.${id}.${Date.now() + 60000}.${expiry}.${sig}`)).toBeNull();
  });

  it('still accepts a legacy v1 cookie, dating it from the standard TTL', () => {
    const exp = Date.now() + SESSION_TTL_MS;
    const sig = crypto.createHmac('sha256', process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET || 'dev-only-insecure-session-secret').update(`identity-123.${exp}`).digest('base64url');
    const session = verifySessionToken(`v1.identity-123.${exp}.${sig}`);
    expect(session?.identityId).toBe('identity-123');
    expect(session!.issuedAtMs).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it('rejects a raw identity id (the old unsigned format)', () => {
    expect(verifySessionToken('identity-123')).toBeNull();
  });

  it('rejects garbage', () => {
    expect(verifySessionToken('')).toBeNull();
    expect(verifySessionToken('v1...')).toBeNull();
    expect(verifySessionToken('v2.id.123.sig')).toBeNull();
    expect(verifySessionToken('v2.id.1.2.sig')).toBeNull();
  });
});
