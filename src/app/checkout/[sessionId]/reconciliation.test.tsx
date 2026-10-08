// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import CheckoutClient from './checkout-client';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
const labels = {
  'payments.checkout.reconciliation_title': 'Payment received — review required',
  'payments.checkout.reconciliation_body': 'The booking is not confirmed. Do not pay again. A refund has not yet been confirmed.',
  'payments.checkout.back_to_trip': 'Back to your trip',
  'payments.checkout.success_title': 'Payment confirmed',
};

describe('checkout reconciliation state', () => {
  afterEach(() => { vi.unstubAllGlobals(); push.mockReset(); });

  it('does not claim a confirmed stay or offer another payment for a captured receipt on review', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({
      sessionId: 'payment', status: 'succeeded', provider: 'opn', amountThb: 4000,
      reconciliationRequired: true, booking: { id: 'booking' }, serviceOrder: null,
    }) }));
    render(<CheckoutClient sessionId="payment" labels={labels} />);
    expect(await screen.findByRole('status')).toHaveTextContent(labels['payments.checkout.reconciliation_body']);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/trips/booking');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByText('Payment confirmed')).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
