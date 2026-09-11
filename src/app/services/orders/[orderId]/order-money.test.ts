import { describe, it, expect } from 'vitest';
import { baht, formatBreakdownValue, isOrderPaid } from './order-money';

// Q47 regression guard: every money field on the order-detail page
// (totalThb, refundAccruedThb, payments[].amountThb, priceBreakdown's
// *_thb entries) arrives as satang straight from the DB.
describe('baht', () => {
  it('converts satang to a baht display string', () => {
    expect(baht(50000)).toBe('500');
    expect(baht(500000)).toBe('5,000');
  });

  it('does not leave a raw satang value looking like baht', () => {
    // The original bug: order.totalThb.toLocaleString() showed 500000 as
    // "500,000" — 100x the real ฿5,000.
    expect(baht(500000)).not.toBe((500000).toLocaleString());
  });
});

describe('formatBreakdownValue', () => {
  it('converts *_thb keys from satang to baht', () => {
    expect(formatBreakdownValue('base_thb', 50000)).toBe('฿500');
    expect(formatBreakdownValue('total_thb', 250000)).toBe('฿2,500');
  });

  it('leaves non-money keys (e.g. quantity) untouched', () => {
    expect(formatBreakdownValue('quantity', 5)).toBe('5');
  });
});

describe('isOrderPaid', () => {
  const paid = [{ status: 'completed' }];
  const none: Array<{ status: string }> = [];

  it('is paid when a payment completed, whatever the status', () => {
    expect(isOrderPaid('placed', paid)).toBe(true);
    expect(isOrderPaid('accepted', paid)).toBe(true);
  });

  it('treats delivery as payment for cash-on-fulfilment, in both delivered states', () => {
    // The regression: a cash order has no payment row, so `fulfilled` alone
    // flipped the badge to "unpaid" the moment the order closed — at exactly
    // the point the orderer confirmed the work was done.
    expect(isOrderPaid('fulfilled', none)).toBe(true);
    expect(isOrderPaid('closed', none)).toBe(true);
  });

  it('does not call an undelivered order paid without a payment', () => {
    for (const status of ['placed', 'paid', 'accepted', 'cancelled', 'declined', 'expired', 'failed']) {
      expect(isOrderPaid(status, none)).toBe(false);
    }
  });
});
