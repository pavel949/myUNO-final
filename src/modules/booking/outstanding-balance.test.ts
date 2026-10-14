import { describe, expect, it } from 'vitest';
import { outstandingStayBalanceSatang } from './outstanding-balance';

describe('collectible stay balance keeps the satang boundary', () => {
  it('shows an initial unpaid hold total even though legacy balance defaults to zero', () => {
    expect(outstandingStayBalanceSatang({ status: 'pending_payment', totalThb: 123456, balanceDueThb: 0 })).toBe(123456);
  });
  it('uses confirmed outstanding balance, never treating satang as display baht', () => {
    const amount = outstandingStayBalanceSatang({ status: 'confirmed', totalThb: 500000, balanceDueThb: 123456 });
    expect(amount).toBe(123456);
    expect(amount / 100).toBe(1234.56);
  });
  it.each(['requested', 'cancelled', 'declined', 'expired'])('does not present %s history as collectible debt', status => {
    expect(outstandingStayBalanceSatang({ status, totalThb: 500000, balanceDueThb: 500000 })).toBe(0);
  });
});
