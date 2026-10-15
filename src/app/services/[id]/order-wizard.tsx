'use client';


import { UI_LOCALE } from '@/lib/format';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';
import { computeOrderPreviewBaht } from './order-preview';
import { serviceContextPath } from './service-context';

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
  projectId,
  unitId,
  whatsappNumber,
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
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);
  const [autoBookingId, setAutoBookingId] = useState<string | null>(null);
  const [availableStays, setAvailableStays] = useState<Array<{ id: string; startDate: string; unit?: { name?: string } }>>([]);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [contextLoaded, setContextLoaded] = useState(Boolean(bookingId || projectId || unitId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Orders need a deterministic project context (the API refuses ambiguity).
  // Arriving without a stay in the URL, attach the guest's current or next
  // confirmed stay automatically — the super-app way: no context questions.
  useEffect(() => {
    if (bookingId || projectId || unitId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/bookings/me?status=confirmed,checked_in&limit=20');
        if (!res.ok) {
          if (res.status === 401 && !cancelled) setNeedsLogin(true);
          return;
        }
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
        if (!cancelled) {
          setAvailableStays(live);
          // A service must never silently attach to the wrong trip.
          if (live.length === 1) setAutoBookingId(live[0].id);
        }
      } catch {
        // Unavailable context is shown as a recoverable handoff, not an empty order.
      } finally {
        if (!cancelled) setContextLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookingId, projectId, unitId]);

  const effectiveBookingId = bookingId ?? autoBookingId;
  const selfPath = serviceContextPath(service.id, { bookingId: effectiveBookingId, projectId, unitId });
  // computeOrderPreviewBaht converts the satang basePriceThb to baht for
  // display only — the server always recomputes the real total from
  // service.basePriceThb (satang), never this preview.
  const previewThb = computeOrderPreviewBaht(service.priceModel, service.basePriceThb, quantity);

  // Quote-priced services (yacht, private chef): the concierge prices them
  // individually — hand the guest to WhatsApp (or messages) instead of a form.
  if (service.priceModel === 'quote') {
    const wa = whatsappNumber ? `https://wa.me/${whatsappNumber.replace(/[^\d]/g, '')}` : null;
    return (
      <div className="stitch-panel p-24">
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

  if (!bookingId && !projectId && !unitId && !effectiveBookingId && contextLoaded && availableStays.length === 0) {
    return (
      <div className="stitch-panel p-24">
        <h2 className="text-heading-3 font-semibold mb-12">{labels['services.wizard.title']}</h2>
        <p className="text-body text-text-secondary mb-16">{labels['services.wizard.no_context']}</p>
        <Link href={needsLogin ? `/login?next=${encodeURIComponent(selfPath)}` : "/messages"} className="inline-flex min-h-48 items-center px-24 rounded-md bg-brand-andaman text-surface-ivory">{labels[needsLogin ? 'services.browse.login_needed' : 'services.wizard.quote_messages']}</Link>
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
          // Sent only when there is no stay to derive the context from, so a
          // guest's booking still wins and nobody can order against a
          // building they only claimed in a query string — the API validates
          // the caller's role against whatever it is given.
          ...(!effectiveBookingId && projectId ? { projectId } : {}),
          ...(!effectiveBookingId && unitId ? { unitId } : {}),
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
      <div className="stitch-panel p-24">
        <h2 className="text-heading-3 font-semibold text-text-ink mb-8">
          {labels['services.wizard.pay_title']}
        </h2>
        <p className="text-body text-text-secondary mb-16">
          {labels['services.wizard.pay_subtitle']}
        </p>
        {error && <p role="alert" className="text-small text-state-error mb-12">{error}</p>}
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
    <div className="stitch-panel p-24">
      <h2 className="text-heading-3 font-semibold text-text-ink mb-16">
        {labels['services.wizard.title']}
      </h2>
      <div className="flex flex-col gap-12">
        {!bookingId && !projectId && !unitId && availableStays.length > 1 && (
          <div className="flex flex-col gap-4">
            <label htmlFor="wizard-stay" className="text-small text-text-stone">{labels['services.wizard.choose_stay']}</label>
            <select id="wizard-stay" value={autoBookingId ?? ''} onChange={(event) => setAutoBookingId(event.target.value || null)} className="min-h-48 px-12 rounded-sm bg-surface-paper border border-border-line text-text-ink">
              <option value="">{labels['services.wizard.choose_stay']}</option>
              {availableStays.map((stay) => <option key={stay.id} value={stay.id}>{stay.unit?.name ?? stay.id} · {stay.startDate.slice(0, 10)}</option>)}
            </select>
          </div>
        )}
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
              ฿{previewThb.toLocaleString(UI_LOCALE)}
            </span>
          </div>
        )}
        {error && <p role="alert" className="text-small text-state-error">{error}</p>}
        <Button onClick={placeOrder} isLoading={busy} disabled={!contextLoaded || !when || (!bookingId && !projectId && !unitId && availableStays.length > 1 && !autoBookingId)} fullWidth>
          {previewThb !== null
            ? fill(labels['services.wizard.place'], { total: previewThb.toLocaleString(UI_LOCALE) })
            : labels['services.wizard.place_no_total']}
        </Button>
      </div>
    </div>
  );
}
