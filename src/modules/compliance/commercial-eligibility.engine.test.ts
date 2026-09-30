import { describe, expect, it } from 'vitest';
import { isCredentialCurrentlyVerified } from './commercial-eligibility.engine';

const now = new Date('2026-09-29T00:00:00Z');
const evidence = () => ({
  status: 'active', verificationStatus: 'verified', evidenceMediaId: 'document-1',
  effectiveDate: new Date('2026-01-01T00:00:00Z'), expiryDate: null as Date | null,
});

describe('evidence-backed commercial eligibility', () => {
  it('requires real verification and evidence, not a default active status', () => {
    expect(isCredentialCurrentlyVerified(evidence(), now)).toBe(true);
    expect(isCredentialCurrentlyVerified({ ...evidence(), evidenceMediaId: null }, now)).toBe(false);
    expect(isCredentialCurrentlyVerified({ ...evidence(), verificationStatus: 'pending' }, now)).toBe(false);
    expect(isCredentialCurrentlyVerified({ ...evidence(), status: 'expired' }, now)).toBe(false);
    expect(isCredentialCurrentlyVerified({ ...evidence(), expiryDate: now }, now)).toBe(false);
    expect(isCredentialCurrentlyVerified({
      ...evidence(), effectiveDate: new Date('2027-01-01'),
    }, now)).toBe(false);
  });
});
