'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';
import { SlaCountdown } from '@/components/SlaCountdown';

interface ProviderOrder {
  id: string;
  status: string;
  scheduledStart: string;
  scheduledEnd: string | null;
  quantity: number;
  totalThb: number;
  serviceTitle: string | null;
  noteToProvider: string | null;
  acceptDeadline: string | null;
}

type Labels = Record<string, string>;

const STATUS_TONE: Record<string, string> = {
  placed: 'text-state-warning',
  paid: 'text-state-warning',
  accepted: 'text-state-success',
  fulfilled: 'text-state-success',
  declined: 'text-state-error',
  cancelled: 'text-text-secondary',
  expired: 'text-text-secondary',
  failed: 'text-state-error',
  closed: 'text-text-secondary',
};

export default function ProviderOrdersClient({
  orders,
  labels,
}: {
  orders: ProviderOrder[];
  labels: Labels;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const act = async (orderId: string, action: string, body?: unknown) => {
    setBusyId(orderId);
    setError(null);
    try {
      const response = await fetch(`/api/service-orders/${orderId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || labels['provider.orders.error_generic']);
      }
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : labels['provider.orders.error_generic']
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      {error && (
        <div className="bg-state-error-soft border border-state-error rounded-lg p-16 mb-24">
          <p className="text-body text-state-error">{error}</p>
        </div>
      )}

      <section className="bg-surface-paper border border-border-line rounded-lg p-24">
        <h2 className="text-heading-3 font-bold text-text-ink mb-8">
          {labels['provider.orders.title']}
        </h2>
        {orders.length === 0 ? (
          <p className="text-body text-text-secondary py-8">
            {labels['provider.orders.empty']}
          </p>
        ) : (
          orders.map((order) => {
            const actionable = order.status === 'placed' || order.status === 'paid';
            return (
              <div
                key={order.id}
                className="flex flex-col md:flex-row md:items-start gap-12 py-16 border-b border-border-line last:border-b-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-body font-semibold text-text-ink">
                    {order.serviceTitle}
                    <span
                      className={`font-normal ${STATUS_TONE[order.status] || 'text-text-secondary'}`}
                    >
                      {' '}
                      · {labels[`services.order_status.${order.status}`] || order.status}
                    </span>
                  </p>
                  <p className="text-small text-text-secondary">
                    {new Date(order.scheduledStart).toLocaleString()} · ×{order.quantity} · ฿
                    {order.totalThb.toLocaleString()}
                  </p>
                  {order.noteToProvider && (
                    <p className="text-small text-text-secondary">
                      {labels['provider.orders.note']}: {order.noteToProvider}
                    </p>
                  )}
                  {actionable && order.acceptDeadline && (
                    <SlaCountdown
                      deadline={order.acceptDeadline}
                      leftTemplate={labels['provider.orders.sla_left']}
                      overdueLabel={labels['provider.orders.sla_overdue']}
                    />
                  )}
                </div>
                <div className="flex flex-col items-stretch md:items-end gap-8">
                  {actionable && (
                    <div className="flex items-center gap-8">
                      <Button
                        size="sm"
                        onClick={() => act(order.id, 'accept')}
                        isLoading={busyId === order.id}
                      >
                        {labels['provider.orders.accept']}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          act(order.id, 'decline', {
                            reason: (reasons[order.id] || '').trim() || undefined,
                          })
                        }
                        isLoading={busyId === order.id}
                      >
                        {labels['provider.orders.decline']}
                      </Button>
                    </div>
                  )}
                  {actionable && (
                    <input
                      type="text"
                      value={reasons[order.id] || ''}
                      onChange={(e) =>
                        setReasons((prev) => ({ ...prev, [order.id]: e.target.value }))
                      }
                      placeholder={labels['provider.orders.decline_reason']}
                      className="h-40 px-12 rounded-sm bg-surface-paper border border-border-line text-small text-text-ink focus:border-brand-andaman focus:outline-none"
                      style={{ width: '200px' }}
                    />
                  )}
                  {order.status === 'accepted' && (
                    <Button
                      size="sm"
                      variant="sun"
                      onClick={() => act(order.id, 'fulfil')}
                      isLoading={busyId === order.id}
                    >
                      {labels['provider.orders.fulfil']}
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
