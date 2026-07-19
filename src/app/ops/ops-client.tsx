'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';

interface OpsBooking {
  id: string;
  status: string;
  startDate: string;
  endDate: string;
  totalThb: number;
  party: number;
  verificationStatus: string | null;
  unitName: string;
  guestName: string;
  paid: boolean;
}

interface OpsServiceOrder {
  id: string;
  scheduledStart: string;
  totalThb: number;
  serviceTitle: string;
  ordererName: string;
}

type Labels = Record<string, string>;

function fill(template: string, params: Record<string, string | number>): string {
  let result = template;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
  }
  return result;
}

export default function OpsBoardClient({
  arrivals,
  departures,
  pendingPayment,
  pendingServiceOrders,
  labels,
}: {
  arrivals: OpsBooking[];
  departures: OpsBooking[];
  pendingPayment: OpsBooking[];
  pendingServiceOrders: OpsServiceOrder[];
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
        throw new Error(data?.error || labels['staff.ops.error_generic']);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['staff.ops.error_generic']);
    } finally {
      setBusyId(null);
    }
  };

  const recordServiceCash = async (order: OpsServiceOrder) => {
    const receiptRef = (receipts[order.id] || '').trim();
    if (!receiptRef) return;
    if (
      !window.confirm(
        fill(labels['staff.ops.confirm_cash'], {
          amount: order.totalThb.toLocaleString(),
        })
      )
    ) {
      return;
    }
    setBusyId(order.id);
    setError(null);
    try {
      const response = await fetch(`/api/service-orders/${order.id}/record-cash-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiptRef }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || labels['staff.ops.error_generic']);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['staff.ops.error_generic']);
    } finally {
      setBusyId(null);
    }
  };

  const Row = ({
    booking,
    action,
  }: {
    booking: OpsBooking;
    action: React.ReactNode;
  }) => (
    <div className="flex flex-col md:flex-row md:items-center gap-12 py-16 border-b border-border-line last:border-b-0">
      <div className="flex-1 min-w-0">
        <p className="text-body font-semibold text-text-ink">
          {booking.guestName}
          <span className="text-text-secondary font-normal"> · {booking.unitName}</span>
        </p>
        <p className="text-small text-text-secondary">
          {new Date(booking.startDate).toLocaleDateString()} —{' '}
          {new Date(booking.endDate).toLocaleDateString()} · {booking.party}{' '}
          {labels['staff.ops.guest'].toLowerCase()} · ฿{booking.totalThb.toLocaleString()}
        </p>
        <p className="text-small">
          <span className={booking.paid ? 'text-state-success' : 'text-state-warning'}>
            {booking.paid ? labels['staff.ops.paid'] : labels['staff.ops.unpaid']}
          </span>
          {' · '}
          <span
            className={
              booking.verificationStatus === 'passports_received'
                ? 'text-state-success'
                : 'text-state-warning'
            }
          >
            {booking.verificationStatus === 'passports_received'
              ? labels['staff.ops.verified']
              : labels['staff.ops.not_verified']}
          </span>
        </p>
      </div>
      <div className="flex items-center gap-8">{action}</div>
    </div>
  );

  const Section = ({
    title,
    bookings,
    action,
  }: {
    title: string;
    bookings: OpsBooking[];
    action: (booking: OpsBooking) => React.ReactNode;
  }) => (
    <section className="bg-surface-paper border border-border-line rounded-lg p-24 mb-24">
      <h2 className="text-heading-3 font-bold text-text-ink mb-8">{title}</h2>
      {bookings.length === 0 ? (
        <p className="text-body text-text-secondary py-8">{labels['staff.ops.empty']}</p>
      ) : (
        bookings.map((booking) => (
          <Row key={booking.id} booking={booking} action={action(booking)} />
        ))
      )}
    </section>
  );

  return (
    <div>
      {error && (
        <div className="bg-state-error-soft border border-state-error rounded-lg p-16 mb-24">
          <p className="text-body text-state-error">{error}</p>
        </div>
      )}

      <Section
        title={labels['staff.ops.arrivals']}
        bookings={arrivals}
        action={(booking) => (
          <Button
            size="sm"
            onClick={() => act(booking.id, 'checkin')}
            isLoading={busyId === booking.id}
            disabled={!booking.paid}
          >
            {labels['staff.ops.check_in']}
          </Button>
        )}
      />

      <Section
        title={labels['staff.ops.departures']}
        bookings={departures}
        action={(booking) => (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => act(booking.id, 'check-out')}
            isLoading={busyId === booking.id}
          >
            {labels['staff.ops.check_out']}
          </Button>
        )}
      />

      <Section
        title={labels['staff.ops.pending_cash']}
        bookings={pendingPayment}
        action={(booking) => (
          <div className="flex items-center gap-8">
            <input
              type="text"
              value={receipts[booking.id] || ''}
              onChange={(e) =>
                setReceipts((prev) => ({ ...prev, [booking.id]: e.target.value }))
              }
              placeholder={labels['staff.ops.receipt_placeholder']}
              className="h-40 px-12 rounded-sm bg-surface-paper border border-border-line text-small text-text-ink focus:border-brand-andaman focus:outline-none w-40 md:w-auto"
              style={{ width: '160px' }}
            />
            <Button
              size="sm"
              variant="sun"
              onClick={() => {
                const receiptRef = (receipts[booking.id] || '').trim();
                if (!receiptRef) return;
                if (
                  window.confirm(
                    fill(labels['staff.ops.confirm_cash'], {
                      amount: booking.totalThb.toLocaleString(),
                    })
                  )
                ) {
                  act(booking.id, 'record-cash-payment', { receiptRef });
                }
              }}
              isLoading={busyId === booking.id}
              disabled={!(receipts[booking.id] || '').trim()}
            >
              {labels['staff.ops.record_cash']}
            </Button>
          </div>
        )}
      />

      <section className="bg-surface-paper border border-border-line rounded-lg p-24 mb-24">
        <h2 className="text-heading-3 font-bold text-text-ink mb-8">
          {labels['staff.ops.service_pending_cash']}
        </h2>
        {pendingServiceOrders.length === 0 ? (
          <p className="text-body text-text-secondary py-8">{labels['staff.ops.empty']}</p>
        ) : (
          pendingServiceOrders.map((order) => (
            <div
              key={order.id}
              className="flex flex-col md:flex-row md:items-center gap-12 py-16 border-b border-border-line last:border-b-0"
            >
              <div className="flex-1 min-w-0">
                <p className="text-body font-semibold text-text-ink">
                  {order.serviceTitle}
                  <span className="text-text-secondary font-normal"> · {order.ordererName}</span>
                </p>
                <p className="text-small text-text-secondary">
                  {new Date(order.scheduledStart).toLocaleString()} · ฿
                  {order.totalThb.toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-8">
                <input
                  type="text"
                  value={receipts[order.id] || ''}
                  onChange={(e) =>
                    setReceipts((prev) => ({ ...prev, [order.id]: e.target.value }))
                  }
                  placeholder={labels['staff.ops.receipt_placeholder']}
                  className="h-40 px-12 rounded-sm bg-surface-paper border border-border-line text-small text-text-ink focus:border-brand-andaman focus:outline-none"
                  style={{ width: '160px' }}
                />
                <Button
                  size="sm"
                  variant="sun"
                  onClick={() => recordServiceCash(order)}
                  isLoading={busyId === order.id}
                  disabled={!(receipts[order.id] || '').trim()}
                >
                  {labels['staff.ops.record_cash']}
                </Button>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
