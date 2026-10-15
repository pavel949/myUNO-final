import { describe, expect, it } from 'vitest';
import { outstandingStayBalanceSatang, assertStayReceivableCollectible } from './outstanding-balance';

describe('collectible stay balance keeps the satang boundary', () => {
  it('shows an initial unpaid hold total even though legacy balance defaults to zero', () => {
    expect(outstandingStayBalanceSatang({ receivableStatus: 'collectible', status: 'pending_payment', totalThb: 123456, balanceDueThb: 0 })).toBe(123456);
  });
  it('uses confirmed outstanding balance, never treating satang as display baht', () => {
    const amount = outstandingStayBalanceSatang({ receivableStatus: 'collectible', status: 'confirmed', totalThb: 500000, balanceDueThb: 123456 });
    expect(amount).toBe(123456);
    expect(amount / 100).toBe(1234.56);
  });
  it.each(['requested', 'cancelled', 'declined', 'expired'])('does not present %s history as collectible debt', status => {
    expect(outstandingStayBalanceSatang({ receivableStatus: 'collectible', status, totalThb: 500000, balanceDueThb: 500000 })).toBe(0);
  });
});


describe('source claims do not authorize collection', () => {
  it.each(['confirmed', 'checked_in', 'checked_out', 'pending_payment'])('excludes %s pending review without changing the gross amount', status => {
    const booking = { status, totalThb: 500000, balanceDueThb: 500000, receivableStatus: 'pending_reconciliation' };
    expect(outstandingStayBalanceSatang(booking)).toBe(0);
    expect(booking.balanceDueThb).toBe(500000);
    expect(() => assertStayReceivableCollectible(booking)).toThrow('need reconciliation');
  });
  it('permits normal collection and fails closed for an unknown state', () => {
    expect(() => assertStayReceivableCollectible({ receivableStatus: 'collectible' })).not.toThrow();
    expect(() => assertStayReceivableCollectible({ receivableStatus: 'unexpected' })).toThrow();
  });
});
