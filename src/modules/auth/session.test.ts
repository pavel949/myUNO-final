import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { createSessionToken, verifySessionToken, SESSION_TTL_MS } from './session';

const sign = (payload: string) => crypto.createHmac('sha256', process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET || 'dev-only-insecure-session-secret').update(payload).digest('base64url');

describe('session tokens', () => {
  it.each([null, 123456789])('round-trips the authenticated generation %s', (generation) => {
    const token = createSessionToken('identity-123', generation);
    expect(verifySessionToken(token)).toMatchObject({ identityId: 'identity-123', generation });
    expect(verifySessionToken(token)!.issuedAtMs).toBeLessThanOrEqual(Date.now());
  });

  it.each([1, 2, 3, 4])('rejects a tampered signed field at index %s', (index) => {
    const parts = createSessionToken('identity-123', null).split('.');
    parts[index] = index === 1 ? 'identity-456' : String(Date.now() + 60000);
    expect(verifySessionToken(parts.join('.'))).toBeNull();
  });

  it('rejects an expired token', () => {
    expect(verifySessionToken(createSessionToken('identity-123', null, -1))).toBeNull();
  });

  it('requires an explicit valid generation rather than silently granting the initial one', () => {
    // @ts-expect-error proving omitted generation fails at runtime as well as at typecheck
    expect(() => createSessionToken('identity-123')).toThrow(/generation/);
    expect(() => createSessionToken('identity-123', Number.NaN)).toThrow(/generation/);
  });

  it('verifies legacy signatures without claiming a generation', () => {
    const issuedAt = Date.now();
    const expiresAt = issuedAt + SESSION_TTL_MS;
    const v1 = `identity-123.${expiresAt}`;
    const v2 = `identity-123.${issuedAt}.${expiresAt}`;
    expect(verifySessionToken(`v1.${v1}.${sign(v1)}`)).toMatchObject({ identityId: 'identity-123' });
    expect(verifySessionToken(`v2.${v2}.${sign(v2)}`)).toMatchObject({ identityId: 'identity-123' });
    expect(verifySessionToken(`v2.${v2}.${sign(v2)}`)?.generation).toBeUndefined();
  });

  it('refuses nonfinite and malformed signed timestamps', () => {
    const payload = `v3.identity-123.none.NaN.${Date.now() + SESSION_TTL_MS}`;
    expect(verifySessionToken(`${payload}.${sign(payload)}`)).toBeNull();
    for (const token of ['identity-123', '', 'v1...', 'v2.id.123.sig', 'v3.id.none.1.2.sig']) {
      expect(verifySessionToken(token)).toBeNull();
    }
  });
});
