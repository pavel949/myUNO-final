'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

interface AdminServiceOrderRow {
  id: string;
  status: string;
  createdAt: string;
  scheduledStart: string;
  totalThb: number;
  serviceTitle: string;
  providerName: string;
  ordererName: string;
}

type Labels = Record<string, string>;

const STATUS_GROUPS = [
  { key: 'active', statuses: 'placed,paid,accepted', labelKey: 'admin.service_orders.filter_active' },
  { key: 'open', statuses: 'placed,paid', labelKey: 'admin.service_orders.filter_new' },
  { key: 'accepted', statuses: 'accepted', labelKey: 'admin.service_orders.filter_accepted' },
  { key: 'failed', statuses: 'failed,declined', labelKey: 'admin.service_orders.filter_issues' },
  { key: 'fulfilled', statuses: 'fulfilled,closed', labelKey: 'admin.service_orders.filter_done' },
] as const;

function mapOrder(raw: Record<string, unknown>): AdminServiceOrderRow {
  const service = raw.service as { title?: string } | null;
  const provider = raw.provider as { name?: string } | null;
  const orderer = raw.orderer as { firstName?: string; lastName?: string } | null;
  const scheduled =
    (raw.scheduled_start as string | Date | undefined) ??
    (raw.scheduledStart as string | Date | undefined);

  return {
    id: String(raw.id),
    status: String(raw.status),
    createdAt: String(raw.createdAt),
    scheduledStart: scheduled ? new Date(scheduled).toISOString() : '',
    totalThb: Number(raw.total_thb ?? raw.totalThb ?? 0),
    serviceTitle: service?.title || '—',
    providerName: provider?.name || '—',
    ordererName: orderer
      ? `${orderer.firstName || ''} ${orderer.lastName || ''}`.trim() || '—'
      : '—',
  };
}

export default function AdminServiceOrdersClient({ labels }: { labels: Labels }) {
  const [activeGroup, setActiveGroup] = useState<(typeof STATUS_GROUPS)[number]['key']>('active');
  const [orders, setOrders] = useState<AdminServiceOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (group: (typeof STATUS_GROUPS)[number]['key']) => {
    setLoading(true);
    setError(null);
    const statuses = STATUS_GROUPS.find((item) => item.key === group)?.statuses ?? 'placed,paid,accepted';
    try {
      const response = await fetch(
        `/api/admin/service-orders?statuses=${encodeURIComponent(statuses)}&limit=100`
      );
      if (!response.ok) {
        throw new Error(labels['admin.service_orders.error']);
      }
      const data = await response.json();
      setOrders(Array.isArray(data) ? data.map((row) => mapOrder(row)) : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['admin.service_orders.error']);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [labels]);

  useEffect(() => {
    void load(activeGroup);
  }, [activeGroup, load]);

  const statusLabel = (status: string) =>
    labels[`services.order_status.${status}`] || status;

  return (
    <div>
      {error && (
        <div className="bg-state-error-soft border border-state-error rounded-lg p-16 mb-24">
          <p className="text-body text-state-error">{error}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-8 mb-24">
        {STATUS_GROUPS.map((group) => (
          <button
            key={group.key}
            type="button"
            onClick={() => setActiveGroup(group.key)}
            className={
              activeGroup === group.key
                ? 'px-12 py-8 rounded-full text-small bg-brand-andaman text-on-dark-text'
                : 'px-12 py-8 rounded-full text-small bg-surface-paper border border-border-line text-text-ink hover:border-brand-andaman'
            }
          >
            {labels[group.labelKey]}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-body text-text-secondary">{labels['admin.service_orders.loading']}</p>
      ) : orders.length === 0 ? (
        <p className="text-body text-text-secondary">{labels['admin.service_orders.empty']}</p>
      ) : (
        <div className="bg-surface-paper border border-border-line rounded-md overflow-hidden">
          <table className="w-full text-left text-body">
            <thead className="bg-surface-ivory text-small text-text-secondary">
              <tr>
                <th className="px-16 py-12">{labels['admin.service_orders.col_service']}</th>
                <th className="px-16 py-12">{labels['admin.service_orders.col_orderer']}</th>
                <th className="px-16 py-12">{labels['admin.service_orders.col_provider']}</th>
                <th className="px-16 py-12">{labels['admin.service_orders.col_scheduled']}</th>
                <th className="px-16 py-12">{labels['admin.service_orders.col_amount']}</th>
                <th className="px-16 py-12">{labels['admin.service_orders.col_status']}</th>
                <th className="px-16 py-12">{labels['admin.service_orders.col_action']}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-t border-border-line">
                  <td className="px-16 py-12 font-semibold text-text-ink">{order.serviceTitle}</td>
                  <td className="px-16 py-12 text-text-secondary">{order.ordererName}</td>
                  <td className="px-16 py-12 text-text-secondary">{order.providerName}</td>
                  <td className="px-16 py-12 text-text-secondary">
                    {order.scheduledStart
                      ? new Date(order.scheduledStart).toLocaleString()
                      : '—'}
                  </td>
                  <td className="px-16 py-12 text-text-ink">
                    ฿{(order.totalThb / 100).toLocaleString()}
                  </td>
                  <td className="px-16 py-12 text-text-secondary">{statusLabel(order.status)}</td>
                  <td className="px-16 py-12">
                    <Link
                      href={`/services/orders/${order.id}`}
                      className="text-brand-andaman font-semibold hover:underline"
                    >
                      {labels['admin.service_orders.view']}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
