'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';

interface AdminBooking {
  id: string;
  status: string;
  startDate: string;
  endDate: string;
  totalThb: number;
  unitName: string;
  guestName: string;
  paid: boolean;
  receiptRef: string | null;
}

type Labels = Record<string, string>;

const statusStyle: Record<string, string> = {
  pending_payment: 'bg-state-warning-soft text-state-warning',
  confirmed: 'bg-state-success-soft text-state-success',
  requested: 'bg-state-warning-soft text-state-warning',
  checked_in: 'bg-state-info-soft text-state-info',
  checked_out: 'bg-surface-ivory text-text-stone',
  cancelled: 'bg-state-error-soft text-state-error',
};

export default function BookingsAdminClient({
  bookings,
  labels,
}: {
  bookings: AdminBooking[];
  labels: Labels;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [receipts, setReceipts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const act = async (bookingId: string, path: string, body?: unknown) => {
    setBusyId(bookingId);
    setError(null);
    try {
      const response = await fetch(`/api/bookings/${bookingId}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || labels['admin.bookings.error_generic']);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['admin.bookings.error_generic']);
    } finally {
      setBusyId(null);
    }
  };

  if (bookings.length === 0) {
    return (
      <div className="bg-surface-paper border border-border-line rounded-lg p-32">
        <p className="text-body text-text-secondary">{labels['admin.bookings.empty']}</p>
      </div>
    );
  }

  return (
    <div className="bg-surface-paper border border-border-line rounded-lg p-24">
      {error && (
        <div className="bg-state-error-soft border border-state-error rounded-lg p-16 mb-16">
          <p className="text-body text-state-error">{error}</p>
        </div>
      )}
      {bookings.map((booking) => (
        <div
          key={booking.id}
          className="flex flex-col lg:flex-row lg:items-center gap-12 py-16 border-b border-border-line last:border-b-0"
        >
          <div className="flex-1 min-w-0">
            <p className="text-body font-semibold text-text-ink">
              {booking.guestName}
              <span className="text-text-secondary font-normal"> · {booking.unitName}</span>
            </p>
            <p className="text-small text-text-secondary">
              {new Date(booking.startDate).toLocaleDateString()} —{' '}
              {new Date(booking.endDate).toLocaleDateString()} · ฿
              {booking.totalThb.toLocaleString()}
              {booking.paid && (
                <span className="text-state-success font-semibold">
                  {' '}
                  · {labels['admin.bookings.paid']}
                  {booking.receiptRef ? ` (${booking.receiptRef})` : ''}
                </span>
              )}
            </p>
          </div>
          <span
            className={`self-start px-12 py-4 rounded-full text-small font-semibold ${
              statusStyle[booking.status] || 'bg-surface-ivory text-text-ink'
            }`}
          >
            {booking.status.replace(/_/g, ' ')}
          </span>
          <div className="flex items-center gap-8">
            {booking.status === 'pending_payment' && (
              <>
                <input
                  type="text"
                  value={receipts[booking.id] || ''}
                  onChange={(e) =>
                    setReceipts((prev) => ({ ...prev, [booking.id]: e.target.value }))
                  }
                  placeholder={labels['admin.bookings.receipt_placeholder']}
                  className="h-40 px-12 rounded-sm bg-surface-paper border border-border-line text-small text-text-ink"
                  style={{ width: '150px' }}
                />
                <Button
                  size="sm"
                  variant="sun"
                  onClick={() =>
                    act(booking.id, 'record-cash-payment', {
                      receiptRef: (receipts[booking.id] || '').trim(),
                    })
                  }
                  isLoading={busyId === booking.id}
                  disabled={!(receipts[booking.id] || '').trim()}
                >
                  {labels['admin.bookings.record_cash']}
                </Button>
              </>
            )}
            {['requested', 'pending_payment', 'confirmed'].includes(booking.status) && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  if (window.confirm(labels['admin.bookings.cancel_confirm'])) {
                    act(booking.id, 'cancel', { reason: 'host_cancelled' });
                  }
                }}
                isLoading={busyId === booking.id}
              >
                {labels['admin.bookings.cancel']}
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
