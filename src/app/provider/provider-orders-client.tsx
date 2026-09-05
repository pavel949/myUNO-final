'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { SlaCountdown } from '@/components/SlaCountdown';
import { NoteSheet } from '@/components/NoteSheet';

function fill(template: string, params: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return result;
}

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

function mapApiOrder(raw: Record<string, unknown>): ProviderOrder {
  const scheduledStart = raw.scheduledStart ?? raw.scheduled_start;
  const scheduledEnd = raw.scheduledEnd ?? raw.scheduled_end;
  const acceptDeadline = raw.acceptDeadline;

  return {
    id: String(raw.id),
    status: String(raw.status),
    scheduledStart: scheduledStart ? new Date(String(scheduledStart)).toISOString() : '',
    scheduledEnd: scheduledEnd ? new Date(String(scheduledEnd)).toISOString() : null,
    quantity: Number(raw.quantity ?? 1),
    totalThb: Number(raw.totalThb ?? raw.total_thb ?? 0),
    serviceTitle:
      (raw.serviceTitle as string | null | undefined) ??
      ((raw.service as { title?: string } | null)?.title ?? null),
    noteToProvider:
      (raw.noteToProvider as string | null | undefined) ??
      (raw.note_to_provider as string | null | undefined) ??
      null,
    acceptDeadline: acceptDeadline ? new Date(String(acceptDeadline)).toISOString() : null,
  };
}

export default function ProviderOrdersClient({
  initialOrders,
  labels,
}: {
  /** Optional SSR seed; tests pass this and skip the live API fetch. */
  initialOrders?: ProviderOrder[];
  labels: Labels;
}) {
  const [orders, setOrders] = useState<ProviderOrder[]>(initialOrders ?? []);
  const [providerName, setProviderName] = useState<string | null>(null);
  const [loading, setLoading] = useState(!initialOrders);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [declineOrder, setDeclineOrder] = useState<ProviderOrder | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    const [meRes, ordersRes] = await Promise.all([
      fetch('/api/provider/me'),
      fetch('/api/provider/orders'),
    ]);

    if (meRes.ok) {
      const meJson = await meRes.json();
      setProviderName(meJson.provider?.name ?? null);
    }

    if (!ordersRes.ok) {
      throw new Error(labels['provider.orders.error_generic']);
    }

    const ordersJson = await ordersRes.json();
    setOrders(
      Array.isArray(ordersJson.orders)
        ? ordersJson.orders.map((row: Record<string, unknown>) => mapApiOrder(row))
        : []
    );
  }, [labels]);

  useEffect(() => {
    if (initialOrders) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await loadQueue();
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : labels['provider.orders.error_generic']
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialOrders, loadQueue, labels]);

  const act = async (orderId: string, action: string, body?: unknown): Promise<boolean> => {
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
      if (initialOrders) {
        setOrders((prev) =>
          prev.map((order) =>
            order.id === orderId
              ? {
                  ...order,
                  status:
                    action === 'accept'
                      ? 'accepted'
                      : action === 'decline'
                        ? 'declined'
                        : action === 'fulfil'
                          ? 'fulfilled'
                          : order.status,
                }
              : order
          )
        );
      } else {
        await loadQueue();
      }
      return true;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : labels['provider.orders.error_generic']
      );
      return false;
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
          {providerName ? (
            <span className="text-body font-normal text-text-secondary"> · {providerName}</span>
          ) : null}
        </h2>
        {loading ? (
          <p className="text-body text-text-secondary py-8">
            {labels['provider.orders.loading']}
          </p>
        ) : orders.length === 0 ? (
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
                    {(order.totalThb / 100).toLocaleString()}
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
                        onClick={() => setDeclineOrder(order)}
                        isLoading={busyId === order.id}
                      >
                        {labels['provider.orders.decline']}
                      </Button>
                    </div>
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

      <NoteSheet
        open={declineOrder !== null}
        onClose={() => setDeclineOrder(null)}
        closeLabel={labels['provider.orders.sheet_close']}
        title={
          declineOrder
            ? fill(labels['provider.orders.decline_sheet_title'], {
                service: declineOrder.serviceTitle ?? '',
              })
            : ''
        }
        noteLabel={labels['provider.orders.decline_reason']}
        value={declineOrder ? reasons[declineOrder.id] || '' : ''}
        onChange={(value) =>
          declineOrder && setReasons((prev) => ({ ...prev, [declineOrder.id]: value }))
        }
        submitLabel={labels['provider.orders.decline_submit']}
        optional
        busy={declineOrder !== null && busyId === declineOrder.id}
        onSubmit={async () => {
          if (!declineOrder) return;
          const reason = (reasons[declineOrder.id] || '').trim() || undefined;
          const ok = await act(declineOrder.id, 'decline', { reason });
          if (ok) setDeclineOrder(null);
        }}
      />
    </div>
  );
}
