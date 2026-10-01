import { describe, it, expect } from 'vitest';
import { eligiblePublicHomeIntents, publicOfferingPriceThb } from './commercial-discovery';

const now = new Date('2026-09-29T00:00:00Z');
const credential = (credentialType: string, overrides: Partial<{
  status: string; verificationStatus: string; evidenceMediaId: string | null;
  effectiveDate: Date | null; expiryDate: Date | null;
}> = {}) => ({
  credentialType, status: 'active', verificationStatus: 'verified',
  evidenceMediaId: credentialType + '-evidence', effectiveDate: null, expiryDate: null,
  ...overrides,
});
const base = (): Parameters<typeof eligiblePublicHomeIntents>[0] => ({
  credentials: [credential('title_legal_use'), credential('sale_authority')],
  permittedUseConfirmedAt: new Date('2026-09-28'),
  complianceRecords: [{ recordType: 'permitted_use', status: 'confirmed' }],
  engagements: [{ status: 'active', mandateMediaId: 'signed-mandate',
    startsOn: new Date('2026-01-01'), endsOn: null }],
  commercialOfferings: [
    { offeringType: 'sale', status: 'active' },
    { offeringType: 'long_term_rental', status: 'active' },
  ],
});

describe('public sale and long-lease publication evidence', () => {
  it('shows each eligible commercial mode without making a nightly stay offer', () => {
    expect(eligiblePublicHomeIntents(base(), now)).toEqual(['buy', 'rent']);
  });
  it('requires verified, effective, unexpired evidence of title AND sale authority', () => {
    for (const changed of [
      credential('sale_authority', { status: 'pending' }),
      credential('sale_authority', { verificationStatus: 'unverified' }),
      credential('sale_authority', { evidenceMediaId: null }),
      credential('sale_authority', { expiryDate: now }),
      credential('sale_authority', { effectiveDate: new Date('2027-01-01') }),
    ]) {
      const input = base();
      input.credentials = [credential('title_legal_use'), changed];
      expect(eligiblePublicHomeIntents(input, now)).toEqual(['rent']);
    }
  });
  it('does not publish long leases without an evidenced effective mandate and confirmed use', () => {
    const input = base();
    input.engagements[0].mandateMediaId = null;
    expect(eligiblePublicHomeIntents(input, now)).toEqual(['buy']);
    input.engagements[0].mandateMediaId = 'signed-mandate';
    input.complianceRecords[0].status = 'pending';
    expect(eligiblePublicHomeIntents(input, now)).toEqual(['buy']);
    input.complianceRecords[0].status = 'confirmed';
    input.engagements[0].endsOn = now;
    expect(eligiblePublicHomeIntents(input, now)).toEqual(['buy']);
  });
  it('does not offer long-term possession while a source PMS still controls occupancy', () => {
    const input = base();
    input.sourceBookingOwned = true;
    expect(eligiblePublicHomeIntents(input, now)).toEqual(['buy']);
  });
  it('never publishes modes with only paused offerings', () => {
    const input = base();
    input.commercialOfferings.forEach(o => o.status = 'draft');
    expect(eligiblePublicHomeIntents(input, now)).toEqual([]);
  });
});


describe('public commercial price normalization', () => {
  it('publishes only supported structured prices', () => {
    expect(publicOfferingPriceThb('sale', { askingPriceThb: 12500000 }))
      .toEqual({ intent: 'buy', amountThb: 12500000 });
    expect(publicOfferingPriceThb('long_term_rental', { monthlyRentThb: 65000 }))
      .toEqual({ intent: 'rent', amountThb: 65000 });
    expect(publicOfferingPriceThb('long_term_rental', { monthlyThb: 72000 }))
      .toEqual({ intent: 'rent', amountThb: 72000 });
  });

  it('fails closed for unsupported, malformed or non-positive prices', () => {
    expect(publicOfferingPriceThb('sale', { price: 12500000 })).toBeNull();
    expect(publicOfferingPriceThb('sale', { askingPriceThb: '12500000' })).toBeNull();
    expect(publicOfferingPriceThb('sale', { askingPriceThb: 0 })).toBeNull();
    expect(publicOfferingPriceThb('short_term_stay', { nightlyThb: 9000 })).toBeNull();
    expect(publicOfferingPriceThb('sale', null)).toBeNull();
  });
});
