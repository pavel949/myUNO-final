import { describe, it, expect } from 'vitest';
import { createSessionToken, verifySessionToken } from './session';

describe('session tokens', () => {
  it('round-trips a valid token', () => {
    const token = createSessionToken('identity-123');
    const session = verifySessionToken(token);
    expect(session).toEqual({ identityId: 'identity-123' });
  });

  it('rejects a tampered identity id', () => {
    const token = createSessionToken('identity-123');
    const [v, , expiry, sig] = token.split('.');
    const tampered = `${v}.identity-456.${expiry}.${sig}`;
    expect(verifySessionToken(tampered)).toBeNull();
  });

  it('rejects a tampered expiry', () => {
    const token = createSessionToken('identity-123');
    const [v, id, , sig] = token.split('.');
    const tampered = `${v}.${id}.${Date.now() + 999999999}.${sig}`;
    expect(verifySessionToken(tampered)).toBeNull();
  });

  it('rejects an expired token', () => {
    const token = createSessionToken('identity-123', -1000);
    expect(verifySessionToken(token)).toBeNull();
  });

  it('rejects a raw identity id (the old unsigned format)', () => {
    expect(verifySessionToken('identity-123')).toBeNull();
  });

  it('rejects garbage', () => {
    expect(verifySessionToken('')).toBeNull();
    expect(verifySessionToken('v1...')).toBeNull();
    expect(verifySessionToken('v2.id.123.sig')).toBeNull();
  });
});
