'use client';


import { UI_LOCALE, APP_TZ } from '@/lib/format';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/Button';
import { LocalDate } from '@/components/LocalDate';

interface SessionInfo {
  sessionId: string;
  amountThb: number;
  provider: string;
  status: string;
  reconciliationRequired: boolean;
  booking: {
    id: string;
    startDate: string;
    endDate: string;
    unitName: string | null;
    projectName: string | null;
  } | null;
  serviceOrder: {
    id: string;
    scheduledStart: string;
    serviceTitle: string | null;
  } | null;
}

type Labels = Record<string, string>;

export default function CheckoutClient({
  sessionId,
  labels,
}: {
  sessionId: string;
  labels: Labels;
}) {
  const router = useRouter();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [reconciliationRequired, setReconciliationRequired] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch(`/api/checkout/${sessionId}`);
        if (response.status === 401) {
          router.push(`/login?next=/checkout/${sessionId}`);
          return;
        }
        if (!response.ok) throw new Error(labels['payments.checkout.not_found']);
        const data: SessionInfo = await response.json();
        setSession(data);
        setReconciliationRequired(!!data.reconciliationRequired);
        if (data.status === 'succeeded' && !data.reconciliationRequired) setSuccess(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : labels['payments.checkout.error_generic']);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [sessionId, router, labels]);

  const handlePayment = async (simulateDecline = false) => {
    if (simulateDecline) {
      setDeclining(true);
    } else {
      setPaying(true);
    }
    setError(null);

    try {
      const response = await fetch('/api/checkout/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, simulateDecline }),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok) {
        setError(result?.error || labels['payments.checkout.error_generic']);
        return;
      }

      if (result.reconciliationRequired) {
        setReconciliationRequired(true);
      } else if (result.confirmed || result.payment?.status === 'succeeded') {
        setSuccess(true);
        const bookingId = result.payment?.bookingId || session?.booking?.id;
        const serviceOrderId =
          result.payment?.serviceOrderId || session?.serviceOrder?.id;
        setTimeout(() => {
          if (serviceOrderId) {
            // SA-2: land on the order's confirmation view, not the catalog
            router.push(`/services/orders/${serviceOrderId}?paid=1`);
          } else {
            router.push(bookingId ? `/bookings/${bookingId}/home-space` : '/trips');
          }
        }, 1500);
      } else {
        setError(labels['payments.checkout.error_generic']);
      }
    } catch {
      setError(labels['payments.checkout.error_generic']);
    } finally {
      setPaying(false);
      setDeclining(false);
    }
  };

  const tripUrl = session?.booking?.id
    ? `/bookings/${session.booking.id}/home-space`
    : '/trips';

  if (loading) {
    return (
      <div className="stitch-workspace flex min-h-screen items-center justify-center">
        <p className="text-body text-text-secondary">{labels['payments.checkout.loading']}</p>
      </div>
    );
  }

  if (reconciliationRequired) {
    return (
      <div className="stitch-workspace flex min-h-screen items-center justify-center px-20 py-40">
        <div className="stitch-panel w-full max-w-lg p-32 text-center" role="status">
          <h1 className="font-display text-display-xl font-semibold mb-12">{labels['payments.checkout.reconciliation_title']}</h1>
          <p className="text-body text-text-secondary mb-24">{labels['payments.checkout.reconciliation_body']}</p>
          <Link href={session?.booking ? `/trips/${session.booking.id}` : '/trips'}>{labels['payments.checkout.back_to_trip']}</Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="stitch-workspace flex min-h-screen items-center justify-center bg-gradient-to-b from-surface-paper to-surface-mint px-20 py-40 md:px-32">
        <div className="stitch-panel w-full max-w-lg p-32 text-center shadow-float">
          <div className="text-heading-1 mb-16" aria-hidden="true">
            ✓
          </div>
          <h1 className="font-display text-display-xl font-semibold text-text-ink mb-12">
            {labels['payments.checkout.success_title']}
          </h1>
          <p className="text-body text-text-secondary">
            {labels['payments.checkout.success_body']}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="stitch-workspace flex min-h-screen items-center justify-center bg-gradient-to-b from-surface-paper to-surface-mint px-20 py-40 md:px-32">
      <div className="stitch-panel w-full max-w-lg p-24 shadow-float md:p-32">
        <h1 className="mb-24 font-display text-display-xl font-semibold tracking-[-0.025em] text-brand-deep">
          {labels['payments.checkout.title']}
        </h1>

        {session?.provider === 'mock' && (
          <div className="mb-24 p-16 bg-state-info-soft rounded-lg border border-border-line">
            <p className="text-small font-semibold text-text-ink">{labels['payments.checkout.mock_title']}</p>
            <p className="text-small text-text-secondary mt-4">{labels['payments.checkout.mock_note']}</p>
          </div>
        )}

        {session && (
          <div className="mb-24 space-y-12 rounded-lg border border-border-line bg-surface-ivory/80 p-20">
            {session.booking?.unitName && (
              <div className="flex justify-between text-small">
                <span className="text-text-secondary">
                  {labels['payments.checkout.stay_label']}
                </span>
                <span className="text-text-ink font-semibold">{session.booking.unitName}</span>
              </div>
            )}
            {session.booking && (
              <div className="flex justify-between text-small">
                <span className="text-text-secondary">
                  {labels['payments.checkout.dates_label']}
                </span>
                <span className="text-text-ink">
                  <LocalDate value={session.booking.startDate} /> —{' '}
                  <LocalDate value={session.booking.endDate} />
                </span>
              </div>
            )}
            {session.serviceOrder && (
              <>
                <div className="flex justify-between text-small">
                  <span className="text-text-secondary">
                    {labels['payments.checkout.service_label']}
                  </span>
                  <span className="text-text-ink font-semibold">
                    {session.serviceOrder.serviceTitle}
                  </span>
                </div>
                <div className="flex justify-between text-small">
                  <span className="text-text-secondary">
                    {labels['payments.checkout.dates_label']}
                  </span>
                  <span className="text-text-ink">
                    {new Date(session.serviceOrder.scheduledStart).toLocaleString(UI_LOCALE, { timeZone: APP_TZ })}
                  </span>
                </div>
              </>
            )}
            <div className="flex justify-between text-body font-semibold pt-8 border-t border-border-line">
              <span className="text-text-ink">{labels['payments.checkout.amount_label']}</span>
              <span className="font-display text-title text-brand-andaman tabular-nums">
                ฿{session.amountThb.toLocaleString(UI_LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2  })}
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-24 p-16 bg-state-error-soft rounded-lg border border-state-error">
            <p className="text-small text-state-error mb-12">{error}</p>
            {session?.booking?.id ? (
              <Link href={tripUrl}>
                <Button variant="ghost" size="sm">
                  {labels['payments.checkout.back_to_trip']}
                </Button>
              </Link>
            ) : null}
          </div>
        )}

        {session?.provider === 'mock' ? (
          <>
            <Button onClick={() => handlePayment(false)} isLoading={paying} fullWidth disabled={!session || declining}>
              {labels['payments.checkout.pay_now']}
            </Button>
            <Button onClick={() => handlePayment(true)} variant="ghost" isLoading={declining} fullWidth disabled={!session || paying} className="mt-12">
              {labels['payments.checkout.decline_simulate']}
            </Button>
            <p className="text-small text-text-stone text-center mt-16">{labels['payments.checkout.test_note']}</p>
          </>
        ) : (
          <div className="text-small text-text-secondary mt-16" role="status">
            {labels['payments.checkout.provider_pending']}
            <Link href={tripUrl} className="block mt-12 text-brand-andaman underline">
              {labels['payments.checkout.back_to_trip']}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
