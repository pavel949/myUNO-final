// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import BookingDetailClient from './booking-client';

const { router } = vi.hoisted(() => ({ router: { push: vi.fn() } }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
const labels = new Proxy<Record<string, string>>({}, { get: (_target, key) => String(key) });

describe('trip payment recovery', () => {
  afterEach(() => { vi.unstubAllGlobals(); router.push.mockReset(); });

  it.each(['pending_payment', 'expired'] as const)('withholds another payment while a %s booking payment needs review', async status => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({
      id: 'booking', status, startDate: '2027-06-01', endDate: '2027-06-04', adults: 2, children: 0,
      totalThb: 4000, unit: { id: 'unit', name: 'Synthetic unit' }, project: { id: 'project', name: 'Synthetic project' },
      payments: [{ id: 'payment', status: status === 'expired' ? 'succeeded' : 'created', method: 'card_provider',
        amountThb: 400000, reconciliationReason: 'CHECKOUT_PROVIDER_OUTCOME_UNKNOWN' }],
      paymentReviewRequired: true, paymentFailed: false, cancellable: false,
      viewer: { isGuest: true, isOwner: false, isStaff: false }, refundPreviewThb: null,
    }) }));
    render(<BookingDetailClient bookingId="booking" labels={labels} />);
    expect(await screen.findByRole('status')).toHaveTextContent('booking.detail.payment_review_body');
    expect(screen.queryByText('booking.detail.pay_card')).not.toBeInTheDocument();
    expect(screen.queryByText('booking.detail.retry_payment')).not.toBeInTheDocument();
    expect(screen.queryByText('booking.detail.paid')).not.toBeInTheDocument();
    expect(screen.queryByText('booking.detail.book_again')).not.toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
  });
});
