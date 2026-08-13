'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';
import { computeOrderPreviewThb } from './order-preview';

/**
 * SA-2 — the single ordering surface on the service page, super-app style:
 * details are above on the page; here the guest refines the order (when /
 * how many / note), sees the previewed total (server recomputes — doc 10),
 * places it, and is taken STRAIGHT into payment: card → mock/provider
 * checkout, or cash on fulfilment → confirmation screen. Quote-priced
 * services route to the concierge instead (the order API refuses them).
 */

interface WizardService {
  id: string;
  title: string;
  priceModel: string;
  basePriceThb: number | null;
}

type Labels = Record<string, string>;

function fill(template: string, params: Record<string, string | number>): string {
  let result = template;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
  }
  return result;
}

export default function OrderWizard({
  service,
  bookingId,
  whatsappNumber,
  labels,
}: {
  service: WizardService;
  bookingId: string | null;
  whatsappNumber: string | null;
  labels: Labels;
}) {
  const router = useRouter();
  const [when, setWhen] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);
  const [autoBookingId, setAutoBookingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Orders need a deterministic project context (the API refuses ambiguity).
  // Arriving without a stay in the URL, attach the guest's current or next
  // confirmed stay automatically — the super-app way: no context questions.
  useEffect(() => {
    if (bookingId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/bookings/me?status=confirmed,checked_in&limit=20');
        if (!res.ok) return;
        const data = await res.json();
        const now = Date.now();
        const live = (data?.bookings ?? []).filter(
          (b: { endDate: string }) => new Date(b.endDate).getTime() > now
        );
        live.sort(
          (a: { status: string; startDate: string }, b: { status: string; startDate: string }) => {
            if (a.status === 'checked_in' && b.status !== 'checked_in') return -1;
            if (b.status === 'checked_in' && a.status !== 'checked_in') return 1;
            return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
          }
        );
        if (!cancelled && live[0]) setAutoBookingId(live[0].id);
      } catch {
        // context attach is best-effort; the API's own error surfaces on place
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  const effectiveBookingId = bookingId ?? autoBookingId;
  const selfPath = `/services/${service.id}${bookingId ? `?bookingId=${bookingId}` : ''}`;
  const previewThb = computeOrderPreviewThb(service.priceModel, service.basePriceThb, quantity);

  // Quote-priced services (yacht, private chef): the concierge prices them
  // individually — hand the guest to WhatsApp (or messages) instead of a form.
  if (service.priceModel === 'quote') {
    const wa = whatsappNumber ? `https://wa.me/${whatsappNumber.replace(/[^\d]/g, '')}` : null;
    return (
      <div className="bg-surface-paper border border-border-line rounded-lg p-24">
        <h2 className="text-heading-3 font-semibold text-text-ink mb-8">
          {labels['services.wizard.quote_title']}
        </h2>
        <p className="text-body text-text-secondary mb-16">
          {labels['services.wizard.quote_body']}
        </p>
        {wa ? (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center h-48 px-24 rounded-md bg-brand-andaman text-surface-ivory font-medium hover:bg-brand-deep"
          >
            {labels['services.wizard.quote_whatsapp']}
          </a>
        ) : (
          <Link
            href="/messages"
            className="inline-flex items-center justify-center h-48 px-24 rounded-md bg-brand-andaman text-surface-ivory font-medium hover:bg-brand-deep"
          >
            {labels['services.wizard.quote_messages']}
          </Link>
        )}
      </div>
    );
  }

  const placeOrder = async () => {
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
          bookingId: effectiveBookingId || undefined,
          noteToProvider: note || undefined,
        }),
      });
      if (response.status === 401) {
        router.push(`/login?next=${encodeURIComponent(selfPath)}`);
        return;
      }
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || labels['services.wizard.error_generic']);
      }
      setPlacedOrderId(data?.order?.id ?? null);
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
      const response = await fetch(`/api/service-orders/${placedOrderId}/checkout`, {
        method: 'POST',
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || labels['services.wizard.error_generic']);
      }
      if (data?.checkoutUrl) {
        router.push(data.checkoutUrl);
        return;
      }
      throw new Error(labels['services.wizard.error_generic']);
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['services.wizard.error_generic']);
      setBusy(false);
    }
  };

  const payCashLater = () => {
    if (!placedOrderId) return;
    router.push(`/services/orders/${placedOrderId}?placed=cash`);
  };

  // Step 2 — payment, immediately after placing (no hunting for a Pay
  // button in a list): card now, or cash on fulfilment.
  if (placedOrderId) {
    return (
      <div className="bg-surface-paper border border-border-line rounded-lg p-24">
        <h2 className="text-heading-3 font-semibold text-text-ink mb-8">
          {labels['services.wizard.pay_title']}
        </h2>
        <p className="text-body text-text-secondary mb-16">
          {labels['services.wizard.pay_subtitle']}
        </p>
        {error && <p className="text-small text-state-error mb-12">{error}</p>}
        <div className="flex flex-col sm:flex-row gap-12">
          <Button onClick={payByCard} isLoading={busy} fullWidth>
            {labels['services.wizard.pay_card']}
          </Button>
          <Button variant="secondary" onClick={payCashLater} disabled={busy} fullWidth>
            {labels['services.wizard.pay_cash']}
          </Button>
        </div>
        <p className="text-small text-text-secondary mt-12">
          {labels['services.wizard.pay_cash_note']}
        </p>
      </div>
    );
  }

  // Step 1 — refine the order.
  return (
    <div className="bg-surface-paper border border-border-line rounded-lg p-24">
      <h2 className="text-heading-3 font-semibold text-text-ink mb-16">
        {labels['services.wizard.title']}
      </h2>
      <div className="flex flex-col gap-12">
        <div className="flex flex-col gap-4">
          <label htmlFor="wizard-when" className="text-small text-text-stone">
            {labels['services.wizard.when']}
          </label>
          <input
            id="wizard-when"
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="h-48 px-12 rounded-sm bg-surface-paper border border-border-line text-text-ink"
          />
        </div>
        <div className="flex flex-col gap-4">
          <label htmlFor="wizard-qty" className="text-small text-text-stone">
            {labels['services.wizard.quantity']}
          </label>
          <input
            id="wizard-qty"
            type="number"
            min={1}
            max={20}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value) || 1)}
            className="h-48 px-12 rounded-sm bg-surface-paper border border-border-line text-text-ink"
          />
        </div>
        <div className="flex flex-col gap-4">
          <label htmlFor="wizard-note" className="text-small text-text-stone">
            {labels['services.wizard.note']}
          </label>
          <input
            id="wizard-note"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="h-48 px-12 rounded-sm bg-surface-paper border border-border-line text-text-ink"
          />
        </div>
        {previewThb !== null && (
          <div className="flex items-center justify-between border-t border-border-line pt-12">
            <span className="text-body text-text-secondary">
              {labels['services.wizard.total_preview']}
            </span>
            <span className="text-heading-3 font-bold text-brand-andaman">
              ฿{previewThb.toLocaleString()}
            </span>
          </div>
        )}
        {error && <p className="text-small text-state-error">{error}</p>}
        <Button onClick={placeOrder} isLoading={busy} disabled={!when} fullWidth>
          {previewThb !== null
            ? fill(labels['services.wizard.place'], { total: previewThb.toLocaleString() })
            : labels['services.wizard.place_no_total']}
        </Button>
      </div>
    </div>
  );
}
