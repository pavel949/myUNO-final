'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/Button';

interface MarketService {
  id: string;
  title: string;
  description: string | null;
  categoryKey: string;
  priceModel: string;
  basePriceThb: number | null;
  durationMin: number | null;
  advanceNoticeHours: number;
  providerName: string | null;
  providerVetted: boolean;
  coverUrl: string | null;
}

interface MyOrder {
  id: string;
  status: string;
  scheduledStart: string;
  totalThb: number;
  serviceTitle: string | null;
}

/** Order states from which the customer may still cancel (F-SVC-3). */
const CANCELLABLE = new Set(['placed', 'paid', 'accepted']);

type Labels = Record<string, string>;

function fill(template: string, params: Record<string, string | number>): string {
  let result = template;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
  }
  return result;
}

export default function ServicesClient({ labels }: { labels: Labels }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookingId = searchParams.get('bookingId');

  const [services, setServices] = useState<MarketService[]>([]);
  const [orders, setOrders] = useState<MyOrder[]>([]);
  const [loggedIn, setLoggedIn] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [when, setWhen] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [servicesRes, ordersRes] = await Promise.all([
      fetch('/api/services'),
      fetch('/api/service-orders'),
    ]);
    if (servicesRes.ok) {
      const data = await servicesRes.json();
      setServices(data.services || []);
    }
    if (ordersRes.status === 401) {
      setLoggedIn(false);
    } else if (ordersRes.ok) {
      const data = await ordersRes.json();
      setOrders(data.orders || []);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const payOrder = async (order: MyOrder) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/service-orders/${order.id}/checkout`, {
        method: 'POST',
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || labels['services.browse.error_generic']);
      }
      if (data?.checkoutUrl) {
        router.push(data.checkoutUrl);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['services.browse.error_generic']);
      setBusy(false);
    }
  };

  const cancelOrder = async (order: MyOrder) => {
    if (!window.confirm(labels['services.order.cancel_confirm'])) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/service-orders/${order.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || labels['services.browse.error_generic']);
      }
      setFlash(labels['services.order.cancelled_note']);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['services.browse.error_generic']);
    } finally {
      setBusy(false);
    }
  };

  const placeOrder = async (service: MarketService) => {
    if (!loggedIn) {
      router.push('/login?next=/services');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/service-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: service.id,
          scheduledStart: when,
          quantity,
          bookingId: bookingId || undefined,
          noteToProvider: note || undefined,
        }),
      });
      const data = await response.json().catch(() => null);
      if (response.status === 401) {
        router.push('/login?next=/services');
        return;
      }
      if (!response.ok) {
        throw new Error(data?.error || labels['services.browse.error_generic']);
      }
      setOpenId(null);
      setWhen('');
      setQuantity(1);
      setNote('');
      setFlash(labels['services.browse.ordered']);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['services.browse.error_generic']);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-surface-background p-24 md:p-32">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-heading-1 font-bold text-text-ink mb-8">
          {labels['services.browse.title']}
        </h1>
        <p className="text-body text-text-secondary mb-24">
          {labels['services.browse.subtitle']}
        </p>

        {flash && (
          <div className="bg-state-success-soft border border-state-success rounded-lg p-16 mb-24">
            <p className="text-body text-state-success">{flash}</p>
          </div>
        )}

        {services.length === 0 ? (
          <div className="bg-surface-paper border border-border-line rounded-lg p-32 text-center mb-32">
            <p className="text-body text-text-secondary">
              {labels['services.browse.empty']}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-24 mb-32">
            {services.map((service) => (
              <div
                key={service.id}
                className="bg-surface-paper border border-border-line rounded-lg overflow-hidden"
              >
                {service.coverUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={service.coverUrl}
                    alt={service.title}
                    className="aspect-video w-full object-cover"
                  />
                )}
                <div className="p-16">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-subtitle font-semibold text-text-ink">
                      {service.title}
                    </h2>
                    {service.providerVetted && (
                      <span className="text-small text-state-success font-semibold">
                        ✓ {labels['services.browse.vetted']}
                      </span>
                    )}
                  </div>
                  {service.providerName && (
                    <p className="text-small text-text-secondary mb-4">{service.providerName}</p>
                  )}
                  {service.description && (
                    <p className="text-small text-text-secondary mb-8">{service.description}</p>
                  )}
                  {service.basePriceThb !== null && (
                    <p className="text-body font-bold text-brand-andaman mb-12">
                      {labels['services.browse.from']} ฿{service.basePriceThb.toLocaleString()}
                    </p>
                  )}

                  {openId === service.id ? (
                    <div className="flex flex-col gap-12">
                      <div className="flex flex-col gap-4">
                        <label htmlFor={`when-${service.id}`} className="text-small text-text-stone">
                          {labels['services.browse.when']}
                        </label>
                        <input
                          id={`when-${service.id}`}
                          type="datetime-local"
                          value={when}
                          onChange={(e) => setWhen(e.target.value)}
                          className="h-48 px-12 rounded-sm bg-surface-paper border border-border-line text-text-ink"
                        />
                      </div>
                      <div className="flex flex-col gap-4">
                        <label htmlFor={`qty-${service.id}`} className="text-small text-text-stone">
                          {labels['services.browse.quantity']}
                        </label>
                        <input
                          id={`qty-${service.id}`}
                          type="number"
                          min={1}
                          max={20}
                          value={quantity}
                          onChange={(e) => setQuantity(Number(e.target.value) || 1)}
                          className="h-48 px-12 rounded-sm bg-surface-paper border border-border-line text-text-ink"
                        />
                      </div>
                      <div className="flex flex-col gap-4">
                        <label htmlFor={`note-${service.id}`} className="text-small text-text-stone">
                          {labels['services.browse.note']}
                        </label>
                        <input
                          id={`note-${service.id}`}
                          type="text"
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          className="h-48 px-12 rounded-sm bg-surface-paper border border-border-line text-text-ink"
                        />
                      </div>
                      {error && <p className="text-small text-state-error">{error}</p>}
                      <Button
                        onClick={() => placeOrder(service)}
                        isLoading={busy}
                        disabled={!when}
                        fullWidth
                      >
                        {fill(labels['services.browse.confirm_order'], {
                          total: ((service.basePriceThb || 0) * quantity).toLocaleString(),
                        })}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setOpenId(service.id);
                        setError(null);
                      }}
                    >
                      {labels['services.browse.order']}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <h2 className="text-heading-2 font-bold text-text-ink mb-16">
          {labels['services.my_orders.title']}
        </h2>
        {!loggedIn || orders.length === 0 ? (
          <div className="bg-surface-paper border border-border-line rounded-lg p-24">
            <p className="text-body text-text-secondary">
              {loggedIn ? labels['services.my_orders.empty'] : labels['services.browse.login_needed']}
            </p>
          </div>
        ) : (
          <div className="bg-surface-paper border border-border-line rounded-lg">
            {orders.map((order) => (
              <div
                key={order.id}
                className="flex flex-wrap items-center justify-between gap-12 p-16 border-b border-border-line last:border-b-0"
              >
                <div>
                  <p className="text-body font-semibold text-text-ink">
                    {order.serviceTitle || '—'}
                  </p>
                  <p className="text-small text-text-secondary">
                    {new Date(order.scheduledStart).toLocaleString()} · ฿
                    {order.totalThb.toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-12">
                  <span className="text-small font-semibold text-text-ink">
                    {labels[`services.order_status.${order.status}`] || order.status}
                  </span>
                  {order.status === 'placed' && (
                    <Button size="sm" onClick={() => payOrder(order)} isLoading={busy}>
                      {labels['services.order.pay']}
                    </Button>
                  )}
                  {CANCELLABLE.has(order.status) && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => cancelOrder(order)}
                      isLoading={busy}
                    >
                      {labels['services.order.cancel']}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
