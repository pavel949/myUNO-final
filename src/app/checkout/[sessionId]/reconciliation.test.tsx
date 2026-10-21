// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import CheckoutClient from './checkout-client';

const { router } = vi.hoisted(() => ({ router: { push: vi.fn() } }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
const labels = {
  'payments.checkout.reconciliation_title': 'Payment received — review required',
  'payments.checkout.reconciliation_body': 'The booking is not confirmed. Do not pay again. A refund has not yet been confirmed.',
  'payments.checkout.back_to_trip': 'Back to your trip',
  'payments.checkout.success_title': 'Payment confirmed',
  'payments.checkout.back_to_order': 'View your order',
  'payments.checkout.pay_now': 'Pay now',
  'payments.checkout.decline_simulate': 'Simulate decline',
  'payments.checkout.refunded_title': 'Payment refunded',
  'payments.checkout.refunded_body': 'This payment has been refunded. See your trip for the current booking status.',
};

describe('checkout reconciliation state', () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); router.push.mockReset(); });

  it('does not claim a confirmed stay or offer another payment for a captured receipt on review', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({
      sessionId: 'payment', status: 'succeeded', provider: 'opn', amountThb: 4000,
      reconciliationRequired: true, booking: { id: 'booking' }, serviceOrder: null,
    }) }));
    render(<CheckoutClient sessionId="payment" labels={labels} />);
    await screen.findByText(labels['payments.checkout.reconciliation_body']);
    expect(screen.getByRole('status')).toHaveTextContent(labels['payments.checkout.reconciliation_body']);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/trips/booking');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByText('Payment confirmed')).not.toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('shows an actually completed refund without claiming the stay was confirmed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({
      sessionId: 'payment', status: 'succeeded', provider: 'opn', amountThb: 4000,
      reconciliationRequired: true, reconciliationRefunded: true, booking: { id: 'booking' }, serviceOrder: null,
    }) }));
    render(<CheckoutClient sessionId="payment" labels={labels} />);
    await screen.findByText(labels['payments.checkout.refunded_body']);
    expect(screen.getByRole('status')).toHaveTextContent(labels['payments.checkout.refunded_body']);
    expect(screen.queryByText('Payment confirmed')).not.toBeInTheDocument();
    expect(screen.queryByText(labels['payments.checkout.reconciliation_body'])).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
  it('offers the reservation next step when a succeeded checkout is refreshed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({
      sessionId: 'payment', status: 'succeeded', provider: 'opn', amountThb: 4000,
      reconciliationRequired: false, booking: { id: 'booking' }, serviceOrder: null,
    }) }));
    render(<CheckoutClient sessionId="payment" labels={labels} />);
    expect(await screen.findByRole('link', { name: 'Back to your trip' })).toHaveAttribute('href', '/trips/booking');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('returns a service receipt to its order instead of the stays list', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({
      sessionId: 'payment', status: 'succeeded', provider: 'opn', amountThb: 4000,
      reconciliationRequired: false, booking: null, serviceOrder: { id: 'order' },
    }) }));
    render(<CheckoutClient sessionId="payment" labels={labels} />);
    expect(await screen.findByRole('link', { name: 'View your order' })).toHaveAttribute('href', '/services/orders/order');
  });

  it('preserves the checkout return route when authentication expires during payment', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({
        sessionId: 'payment', status: 'pending', provider: 'mock', amountThb: 4000,
        reconciliationRequired: false, booking: { id: 'booking' }, serviceOrder: null,
      }) })
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) }));
    render(<CheckoutClient sessionId="payment" labels={labels} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Pay now' }));
    const { waitFor } = await import('@testing-library/react');
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/login?next=%2Fcheckout%2Fpayment'));
  });

});
