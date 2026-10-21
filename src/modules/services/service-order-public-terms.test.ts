import { describe, expect, it } from 'vitest';
import { customerServiceTerms } from './service-order-customer-view';
describe('customer service terms allowlist', () => {
  it('never exposes commission, responsible organization IDs or provider config', () => {
    expect(customerServiceTerms({ collector: 'myuno', fulfilmentMode: 'inhouse', responsibleOrganizationName: 'Real Organization', cancellationWindowHours: 24, totalThb: 50000, takeRatePct: 15, takeRatePctSnapshot: 15, responsibleOrganizationId: 'private-id', providerId: 'provider', version: 3 })).toEqual({ collector: 'myuno', fulfilmentMode: 'inhouse', responsibleOrganizationName: 'Real Organization', cancellationWindowHours: 24, totalThb: 50000 });
  });
  it('handles missing historical snapshots', () => { expect(customerServiceTerms({})).toBeNull(); expect(customerServiceTerms(null)).toBeNull(); });
});
