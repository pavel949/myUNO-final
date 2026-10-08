// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import BookingDetailClient from './booking-client';

const { router } = vi.hoisted(() => ({ router: { push: vi.fn() } }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
const labels = new Proxy<Record<string, string>>({}, { get: (_target, key) => String(key) });

describe('trip payment recovery', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); router.push.mockReset(); });

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

  it('refreshes the received payment and refund before asking for cancellation again', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(true).mockReturnValueOnce(false).mockReturnValueOnce(true);
    let loads = 0;
    const fixture = { id: 'booking', startDate: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      endDate: new Date(Date.now() + 10 * 86_400_000).toISOString(), adults: 2, children: 0,
      totalThb: 4000, unit: { id: 'unit', name: 'Synthetic unit' }, project: { id: 'project', name: 'Synthetic project' },
      paymentReviewRequired: false, paymentFailed: false, cancellable: true,
      viewer: { isGuest: true, isOwner: false, isStaff: false }, refundPreviewThb: null };
    const fetcher = vi.fn(async (url: string, _options?: RequestInit) => {
      if (url === '/api/bookings/booking') {
        loads++;
        return { ok: true, status: 200, json: async () => ({ ...fixture,
          status: loads === 1 ? 'pending_payment' : 'confirmed', refundPreviewThb: loads === 1 ? null : 4000,
          cancellationQuote: { bookingId: 'booking', bookingUpdatedAt: loads === 1 ? '2026-10-08T10:00:00.000Z' : '2026-10-08T10:01:00.000Z',
            bookingStatus: loads === 1 ? 'pending_payment' : 'confirmed', refundAmountSatang: loads === 1 ? 0 : 400000 },
          payments: loads === 1 ? [] : [{ id: 'payment', status: 'succeeded', method: 'card_provider', amountThb: 400000 }],
        }) };
      }
      return { ok: false, status: 409, json: async () => ({ code: 'BOOKING_CHANGED' }) };
    });
    vi.stubGlobal('fetch', fetcher);
    const cancellationLabels = new Proxy<Record<string, string>>({
      'booking.detail.cancel_confirm': 'Cancel with refund {refund}',
    }, { get: (target, key) => target[String(key)] ?? String(key) });
    render(<BookingDetailClient bookingId="booking" labels={cancellationLabels} />);
    fireEvent.click(await screen.findByRole('button', { name: 'booking.detail.cancel_button' }));
    expect(await screen.findByText('booking.detail.cancel_changed')).toBeInTheDocument();
    await waitFor(() => expect(loads).toBe(2));
    fireEvent.click(screen.getByRole('button', { name: 'booking.detail.cancel_button' }));
    expect(confirm).toHaveBeenNthCalledWith(2, 'Cancel with refund 4,000');
    expect(fetcher.mock.calls.filter(([url]) => url === '/api/bookings/booking/cancel')).toHaveLength(1);
    const posted = fetcher.mock.calls.find(([url]) => url === '/api/bookings/booking/cancel')!;
    expect(JSON.parse(posted[1]!.body as string)).toMatchObject({ cancellationQuote: {
      bookingId: 'booking', bookingUpdatedAt: '2026-10-08T10:00:00.000Z', bookingStatus: 'pending_payment', refundAmountSatang: 0,
    } });
    fireEvent.click(screen.getByRole('button', { name: 'booking.detail.cancel_button' }));
    await waitFor(() => expect(fetcher.mock.calls.filter(([url]) => url === '/api/bookings/booking/cancel')).toHaveLength(2));
    expect(confirm).toHaveBeenNthCalledWith(3, 'Cancel with refund 4,000');
    const acceptedAfterReview = fetcher.mock.calls.filter(([url]) => url === '/api/bookings/booking/cancel')[1];
    expect(JSON.parse(acceptedAfterReview[1]!.body as string)).toMatchObject({ cancellationQuote: {
      bookingId: 'booking', bookingUpdatedAt: '2026-10-08T10:01:00.000Z', bookingStatus: 'confirmed', refundAmountSatang: 400000,
    } });
  });
});
