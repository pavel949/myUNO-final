'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';

interface BookingDetail {
  id: string;
  status: string;
  startDate: string;
  endDate: string;
  adults: number;
  children: number;
  totalThb: number;
  refundAccruedThb?: number | null;
  guestNote?: string | null;
  unit: { id: string; name: string } | null;
  project: { id: string; name: string } | null;
  payments: {
    id: string;
    status: string;
    method: string;
    amountThb: number;
    succeededAt?: string | null;
    receiptRef?: string | null;
  }[];
  viewer: { isGuest: boolean; isOwner: boolean; isStaff: boolean };
  cancellable: boolean;
  refundPreviewThb: number | null;
}

type Labels = Record<string, string>;

function fill(template: string, params: Record<string, string | number>): string {
  let result = template;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
  }
  return result;
}

const statusStyles: Record<string, string> = {
  pending_payment: 'bg-state-warning-soft text-state-warning',
  confirmed: 'bg-state-success-soft text-state-success',
  requested: 'bg-state-warning-soft text-state-warning',
  checked_in: 'bg-state-info-soft text-state-info',
  checked_out: 'bg-surface-ivory text-text-stone',
  cancelled: 'bg-state-error-soft text-state-error',
  declined: 'bg-state-error-soft text-state-error',
  expired: 'bg-surface-ivory text-text-stone',
};

export default function BookingDetailClient({
  bookingId,
  labels,
}: {
  bookingId: string;
  labels: Labels;
}) {
  const router = useRouter();
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/bookings/${bookingId}`);
      if (response.status === 401) {
        router.push(`/login?next=/trips/${bookingId}`);
        return;
      }
      if (!response.ok) throw new Error(labels['booking.detail.not_found']);
      setBooking(await response.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['booking.detail.error_generic']);
    } finally {
      setLoading(false);
    }
  }, [bookingId, router, labels]);

  useEffect(() => {
    load();
  }, [load]);

  const handlePayCard = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/bookings/${bookingId}/checkout`, { method: 'POST' });
      if (!response.ok) throw new Error(labels['booking.detail.error_generic']);
      const data = await response.json();
      router.push(data.checkoutUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['booking.detail.error_generic']);
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    if (!booking) return;
    const paid = booking.payments.some((p) => p.status === 'succeeded');
    const message = paid
      ? fill(labels['booking.detail.cancel_confirm'], {
          refund: (booking.refundPreviewThb ?? 0).toLocaleString(),
        })
      : labels['booking.detail.cancel_confirm_unpaid'];
    if (!window.confirm(message)) return;

    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'guest_cancelled' }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || labels['booking.detail.error_generic']);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['booking.detail.error_generic']);
    } finally {
      setBusy(false);
    }
  };

  const handleModify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newStart && !newEnd) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/bookings/${bookingId}/modify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(newStart && { startDate: newStart }),
          ...(newEnd && { endDate: newEnd }),
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || labels['booking.detail.error_generic']);
      }
      if (data?.checkout?.checkoutUrl) {
        router.push(data.checkout.checkoutUrl);
        return;
      }
      setNewStart('');
      setNewEnd('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['booking.detail.error_generic']);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-background p-32">
        <p className="text-body text-text-secondary text-center">
          {labels['booking.detail.loading']}
        </p>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-surface-background p-32">
        <div className="max-w-3xl mx-auto">
          <div className="bg-state-error-soft border border-state-error rounded-lg p-16">
            <p className="text-body text-state-error">
              {error || labels['booking.detail.not_found']}
            </p>
          </div>
          <p className="mt-16">
            <Link href="/trips" className="text-brand-andaman font-semibold hover:underline">
              {labels['booking.detail.back']}
            </Link>
          </p>
        </div>
      </div>
    );
  }

  const paid = booking.payments.some((p) => p.status === 'succeeded');
  const succeededPayment = booking.payments.find((p) => p.status === 'succeeded');
  const statusLabel =
    labels[`booking.detail.status.${booking.status}`] || booking.status.replace(/_/g, ' ');
  const stayStartedOrConfirmed = ['confirmed', 'checked_in'].includes(booking.status);
  const upcoming = new Date(booking.startDate) > new Date();

  return (
    <div className="min-h-screen bg-surface-background p-24 md:p-32">
      <div className="max-w-3xl mx-auto">
        <p className="mb-16">
          <Link href="/trips" className="text-brand-andaman font-semibold hover:underline">
            {labels['booking.detail.back']}
          </Link>
        </p>

        <div className="bg-surface-paper border border-border-line rounded-lg p-24 mb-24">
          <div className="flex items-start justify-between mb-16">
            <div>
              <h1 className="text-heading-2 font-bold text-text-ink">
                {booking.unit?.name || labels['booking.detail.title']}
              </h1>
              {booking.project?.name && (
                <p className="text-small text-text-secondary">{booking.project.name}</p>
              )}
            </div>
            <span
              className={`px-12 py-4 rounded-full text-small font-semibold ${
                statusStyles[booking.status] || 'bg-surface-ivory text-text-ink'
              }`}
            >
              {statusLabel}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-16 mb-16 pb-16 border-b border-border-line">
            <div>
              <p className="text-small text-text-secondary">{labels['booking.detail.check_in']}</p>
              <p className="text-body font-semibold text-text-ink">
                {new Date(booking.startDate).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-small text-text-secondary">
                {labels['booking.detail.check_out']}
              </p>
              <p className="text-body font-semibold text-text-ink">
                {new Date(booking.endDate).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-small text-text-secondary">{labels['booking.detail.guests']}</p>
              <p className="text-body font-semibold text-text-ink">
                {booking.adults + booking.children}
              </p>
            </div>
            <div>
              <p className="text-small text-text-secondary">{labels['booking.detail.total']}</p>
              <p className="text-body font-semibold text-brand-andaman">
                ฿{booking.totalThb.toLocaleString()}
              </p>
            </div>
          </div>

          {stayStartedOrConfirmed && (
            <Link href={`/bookings/${booking.id}/home-space`}>
              <Button variant="secondary" size="sm">
                {labels['booking.detail.home_space']}
              </Button>
            </Link>
          )}
        </div>

        {error && (
          <div className="bg-state-error-soft border border-state-error rounded-lg p-16 mb-24">
            <p className="text-body text-state-error">{error}</p>
          </div>
        )}

        {/* Payment */}
        <div className="bg-surface-paper border border-border-line rounded-lg p-24 mb-24">
          <h2 className="text-heading-3 font-bold text-text-ink mb-12">
            {labels['booking.detail.payment_title']}
          </h2>
          {paid ? (
            <p className="text-body text-state-success font-semibold">
              {labels['booking.detail.paid']}
              {succeededPayment?.receiptRef && (
                <span className="text-text-secondary font-normal">
                  {' '}
                  · {labels['booking.detail.receipt']} {succeededPayment.receiptRef}
                </span>
              )}
            </p>
          ) : booking.status === 'pending_payment' && booking.viewer.isGuest ? (
            <div>
              <p className="text-body text-state-warning font-semibold mb-12">
                {labels['booking.detail.awaiting_payment']}
              </p>
              <Button onClick={handlePayCard} isLoading={busy} size="sm">
                {labels['booking.detail.pay_card']}
              </Button>
              <p className="text-small text-text-secondary mt-12">
                {labels['booking.detail.pay_cash_note']}
              </p>
            </div>
          ) : (
            <p className="text-body text-text-secondary">{statusLabel}</p>
          )}
        </div>

        {/* Change dates */}
        {booking.cancellable && upcoming && booking.viewer.isGuest && (
          <div className="bg-surface-paper border border-border-line rounded-lg p-24 mb-24">
            <h2 className="text-heading-3 font-bold text-text-ink mb-12">
              {labels['booking.detail.modify_title']}
            </h2>
            <form onSubmit={handleModify} className="grid grid-cols-1 md:grid-cols-3 gap-12 items-end">
              <div className="flex flex-col gap-4">
                <label htmlFor="modify-start" className="text-small text-text-secondary">
                  {labels['booking.detail.modify_start']}
                </label>
                <input
                  id="modify-start"
                  type="date"
                  value={newStart}
                  onChange={(e) => setNewStart(e.target.value)}
                  className="h-48 px-12 rounded-sm bg-surface-paper border border-border-line text-text-ink focus:border-brand-andaman focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-4">
                <label htmlFor="modify-end" className="text-small text-text-secondary">
                  {labels['booking.detail.modify_end']}
                </label>
                <input
                  id="modify-end"
                  type="date"
                  value={newEnd}
                  onChange={(e) => setNewEnd(e.target.value)}
                  className="h-48 px-12 rounded-sm bg-surface-paper border border-border-line text-text-ink focus:border-brand-andaman focus:outline-none"
                />
              </div>
              <Button type="submit" variant="secondary" isLoading={busy} disabled={!newStart && !newEnd}>
                {labels['booking.detail.modify_submit']}
              </Button>
            </form>
            <p className="text-small text-text-secondary mt-12">
              {labels['booking.detail.modify_note']}
            </p>
          </div>
        )}

        {/* Cancel */}
        {booking.cancellable && booking.viewer.isGuest && (
          <div className="bg-surface-paper border border-border-line rounded-lg p-24">
            <h2 className="text-heading-3 font-bold text-text-ink mb-12">
              {labels['booking.detail.cancel_title']}
            </h2>
            <Button variant="destructive" size="sm" onClick={handleCancel} isLoading={busy}>
              {labels['booking.detail.cancel_button']}
            </Button>
          </div>
        )}

        {booking.status === 'cancelled' && (
          <div className="bg-surface-paper border border-border-line rounded-lg p-24">
            <p className="text-body text-text-secondary">
              {fill(labels['booking.detail.cancelled_note'], {
                refund: (booking.refundAccruedThb ?? 0).toLocaleString(),
              })}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
