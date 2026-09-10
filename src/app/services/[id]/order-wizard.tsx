'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';
import { computeOrderPreviewBaht } from './order-preview';

interface WizardService {
  id: string;
  title: string;
  categoryKey: string;
  priceModel: string;
  basePriceThb: number | null;
}

type Labels = Record<string, string>;
type Dimensions = Record<string, number>;

function fill(template: string, params: Record<string, string | number>): string {
  let result = template;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
  }
  return result;
}

function positive(value: string, fallback = 1) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

export default function OrderWizard({
  service,
  bookingId,
  projectId,
  unitId,
  labels,
}: {
  service: WizardService;
  bookingId: string | null;
  projectId?: string | null;
  unitId?: string | null;
  whatsappNumber: string | null;
  labels: Labels;
}) {
  const router = useRouter();
  const [when, setWhen] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [secondary, setSecondary] = useState('0');
  const [tertiary, setTertiary] = useState('1');
  const [area, setArea] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);
  const [quoteRequestId, setQuoteRequestId] = useState<string | null>(null);
  const [autoBookingId, setAutoBookingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (bookingId || projectId || unitId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/bookings/me?status=confirmed,checked_in&limit=20');
        if (!res.ok) return;
        const data = await res.json();
        const now = Date.now();
        const live = (data?.bookings ?? []).filter((b: { endDate: string }) => new Date(b.endDate).getTime() > now);
        live.sort((a: { status: string; startDate: string }, b: { status: string; startDate: string }) => {
          if (a.status === 'checked_in' && b.status !== 'checked_in') return -1;
          if (b.status === 'checked_in' && a.status !== 'checked_in') return 1;
          return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
        });
        if (!cancelled && live[0]) setAutoBookingId(live[0].id);
      } catch {
        // Standalone ordering remains available when no stay is found.
      }
    })();
    return () => { cancelled = true; };
  }, [bookingId, projectId, unitId]);

  const effectiveBookingId = bookingId ?? autoBookingId;
  const standalone = !effectiveBookingId && !projectId;
  const q1 = Math.max(1, positive(quantity, 1));
  const previewThb = computeOrderPreviewBaht(service.priceModel, service.basePriceThb, q1);

  const quantityDimensions: Dimensions = useMemo(() => {
    switch (service.categoryKey) {
      case 'transfer':
        return { passengers: q1, luggage: positive(secondary, 0), vehicles: Math.max(1, positive(tertiary, 1)) };
      case 'chef':
        return { guests: q1, hours: Math.max(1, positive(secondary, 1)) };
      case 'cleaning':
        return { rooms: q1, hours: positive(secondary, 0), areaSqm: positive(tertiary, 0) };
      case 'car_hire':
      case 'car_rental':
        return { days: q1, vehicles: Math.max(1, positive(secondary, 1)) };
      case 'flowers':
      case 'deliveries':
      case 'groceries':
        return { items: q1 };
      default:
        return service.priceModel === 'per_hour' ? { units: 1, hours: q1 } : service.priceModel === 'per_person' ? { units: q1, persons: q1 } : { units: q1 };
    }
  }, [service.categoryKey, service.priceModel, q1, secondary, tertiary]);

  const context = standalone ? { area: area.trim() || undefined, address: address.trim() || undefined } : undefined;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const isQuote = service.priceModel === 'quote';
      if (!isQuote && !when) throw new Error(labels['services.wizard.when_required']);
      if (standalone && !area.trim() && !address.trim()) throw new Error(labels['services.wizard.location_required']);

      const response = await fetch(isQuote ? '/api/service-quotes' : '/api/service-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: service.id,
          ...(when ? { scheduledStart: when } : {}),
          bookingId: effectiveBookingId || undefined,
          ...(!effectiveBookingId && projectId ? { projectId } : {}),
          ...(!effectiveBookingId && unitId ? { unitId } : {}),
          serviceContext: context,
          quantityDimensions,
          noteToProvider: note || undefined,
        }),
      });
      if (response.status === 401) {
        router.push(`/login?next=${encodeURIComponent(`/services/${service.id}`)}`);
        return;
      }
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || labels['services.wizard.error_generic']);
      if (isQuote) setQuoteRequestId(data?.request?.id ?? null);
      else setPlacedOrderId(data?.order?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['services.wizard.error_generic']);
    } finally {
      setBusy(false);
    }
  };

  const payByCard = async () => {
    if (!placedOrderId) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/service-orders/${placedOrderId}/checkout`, { method: 'POST' });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.checkoutUrl) throw new Error(data?.error || labels['services.wizard.error_generic']);
      router.push(data.checkoutUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['services.wizard.error_generic']);
      setBusy(false);
    }
  };

  if (quoteRequestId) {
    return (
      <div className="bg-surface-paper border border-border-line rounded-lg p-24">
        <h2 className="text-heading-3 font-semibold text-text-ink">{labels['services.wizard.quote_requested']}</h2>
        <p className="mt-8 text-body text-text-secondary">{labels['services.wizard.quote_requested_body']}</p>
      </div>
    );
  }

  if (placedOrderId) {
    return (
      <div className="bg-surface-paper border border-border-line rounded-lg p-24">
        <h2 className="text-heading-3 font-semibold text-text-ink mb-8">{labels['services.wizard.pay_title']}</h2>
        <p className="text-body text-text-secondary mb-16">{labels['services.wizard.pay_subtitle']}</p>
        {error && <p className="text-small text-state-error mb-12">{error}</p>}
        <div className="flex flex-col sm:flex-row gap-12">
          <Button onClick={payByCard} isLoading={busy} fullWidth>{labels['services.wizard.pay_card']}</Button>
          <Button variant="secondary" onClick={() => router.push(`/services/orders/${placedOrderId}?placed=cash`)} disabled={busy} fullWidth>
            {labels['services.wizard.pay_cash']}
          </Button>
        </div>
      </div>
    );
  }

  const primaryLabel = service.categoryKey === 'transfer' ? labels['services.wizard.passengers']
    : service.categoryKey === 'chef' ? labels['services.wizard.guests']
    : service.categoryKey === 'cleaning' ? labels['services.wizard.rooms']
    : ['car_hire', 'car_rental'].includes(service.categoryKey) ? labels['services.wizard.days']
    : service.priceModel === 'per_hour' ? labels['services.wizard.hours']
    : service.priceModel === 'per_person' ? labels['services.wizard.people']
    : labels['services.wizard.quantity'];

  return (
    <div className="bg-surface-paper border border-border-line rounded-lg p-24">
      <h2 className="text-heading-3 font-semibold text-text-ink mb-16">{service.priceModel === 'quote' ? labels['services.wizard.quote_title'] : labels['services.wizard.title']}</h2>
      <div className="flex flex-col gap-12">
        {service.priceModel !== 'quote' && (
          <label className="flex flex-col gap-4 text-small text-text-stone">
            {labels['services.wizard.when']}
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="h-48 px-12 rounded-sm bg-surface-paper border border-border-line text-text-ink" />
          </label>
        )}
        <label className="flex flex-col gap-4 text-small text-text-stone">
          {primaryLabel}
          <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} className="h-48 px-12 rounded-sm bg-surface-paper border border-border-line text-text-ink" />
        </label>
        {service.categoryKey === 'transfer' && (
          <div className="grid grid-cols-2 gap-12">
            <label className="flex flex-col gap-4 text-small text-text-stone">{labels['services.wizard.luggage']}<input type="number" min={0} value={secondary} onChange={(e) => setSecondary(e.target.value)} className="h-48 px-12 rounded-sm border border-border-line" /></label>
            <label className="flex flex-col gap-4 text-small text-text-stone">{labels['services.wizard.vehicles']}<input type="number" min={1} value={tertiary} onChange={(e) => setTertiary(e.target.value)} className="h-48 px-12 rounded-sm border border-border-line" /></label>
          </div>
        )}
        {standalone && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <label className="flex flex-col gap-4 text-small text-text-stone">{labels['services.wizard.area']}<input value={area} onChange={(e) => setArea(e.target.value)} className="h-48 px-12 rounded-sm border border-border-line" /></label>
            <label className="flex flex-col gap-4 text-small text-text-stone">{labels['services.wizard.address']}<input value={address} onChange={(e) => setAddress(e.target.value)} className="h-48 px-12 rounded-sm border border-border-line" /></label>
          </div>
        )}
        <label className="flex flex-col gap-4 text-small text-text-stone">
          {labels['services.wizard.note']}
          <input value={note} onChange={(e) => setNote(e.target.value)} className="h-48 px-12 rounded-sm bg-surface-paper border border-border-line text-text-ink" />
        </label>
        {previewThb !== null && service.priceModel !== 'quote' && (
          <div className="flex items-center justify-between border-t border-border-line pt-12">
            <span className="text-body text-text-secondary">{labels['services.wizard.total_preview']}</span>
            <span className="text-heading-3 font-bold text-brand-andaman">฿{previewThb.toLocaleString()}</span>
          </div>
        )}
        {error && <p className="text-small text-state-error">{error}</p>}
        <Button onClick={submit} isLoading={busy} disabled={service.priceModel !== 'quote' && !when} fullWidth>
          {service.priceModel === 'quote'
            ? labels['services.wizard.request_quote']
            : previewThb !== null
              ? fill(labels['services.wizard.place'], { total: previewThb.toLocaleString() })
              : labels['services.wizard.place_no_total']}
        </Button>
      </div>
    </div>
  );
}
