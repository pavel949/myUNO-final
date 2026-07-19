'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';

interface SessionInfo {
  sessionId: string;
  amountThb: number;
  status: string;
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
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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
        if (data.status === 'succeeded') setSuccess(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : labels['payments.checkout.error_generic']);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [sessionId, router, labels]);

  const handlePayment = async () => {
    setPaying(true);
    setError(null);

    try {
      const response = await fetch('/api/checkout/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok) {
        setError(result?.error || labels['payments.checkout.error_generic']);
        return;
      }

      if (result.confirmed || result.payment?.status === 'succeeded') {
        setSuccess(true);
        const bookingId = result.payment?.bookingId || session?.booking?.id;
        const isServiceOrder = Boolean(
          result.payment?.serviceOrderId || session?.serviceOrder?.id
        );
        setTimeout(() => {
          if (isServiceOrder) {
            router.push('/services');
          } else {
            router.push(bookingId ? `/trips/${bookingId}` : '/trips');
          }
        }, 1500);
      } else {
        setError(labels['payments.checkout.error_generic']);
      }
    } catch {
      setError(labels['payments.checkout.error_generic']);
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-background">
        <p className="text-body text-text-secondary">{labels['payments.checkout.loading']}</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-background px-24">
        <div className="bg-surface-paper border border-border-line rounded-lg p-32 max-w-md w-full text-center">
          <div className="text-heading-1 mb-16" aria-hidden="true">
            ✓
          </div>
          <h1 className="text-heading-2 font-bold text-text-ink mb-12">
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
    <div className="min-h-screen flex items-center justify-center bg-surface-background px-24">
      <div className="bg-surface-paper border border-border-line rounded-lg p-32 max-w-md w-full">
        <h1 className="text-heading-2 font-bold text-text-ink mb-24">
          {labels['payments.checkout.title']}
        </h1>

        <div className="mb-24 p-16 bg-state-info-soft rounded-lg border border-border-line">
          <p className="text-small font-semibold text-text-ink">
            {labels['payments.checkout.mock_title']}
          </p>
          <p className="text-small text-text-secondary mt-4">
            {labels['payments.checkout.mock_note']}
          </p>
        </div>

        {session && (
          <div className="mb-24 p-16 bg-surface-background rounded-lg border border-border-line space-y-8">
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
                  {new Date(session.booking.startDate).toLocaleDateString()} —{' '}
                  {new Date(session.booking.endDate).toLocaleDateString()}
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
                    {new Date(session.serviceOrder.scheduledStart).toLocaleString()}
                  </span>
                </div>
              </>
            )}
            <div className="flex justify-between text-body font-bold pt-8 border-t border-border-line">
              <span className="text-text-ink">{labels['payments.checkout.amount_label']}</span>
              <span className="text-brand-andaman">฿{session.amountThb.toLocaleString()}</span>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-24 p-16 bg-state-error-soft rounded-lg border border-state-error">
            <p className="text-small text-state-error">{error}</p>
          </div>
        )}

        <Button onClick={handlePayment} isLoading={paying} fullWidth disabled={!session}>
          {labels['payments.checkout.pay_now']}
        </Button>

        <p className="text-small text-text-stone text-center mt-16">
          {labels['payments.checkout.test_note']}
        </p>
      </div>
    </div>
  );
}
