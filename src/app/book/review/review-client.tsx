'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/Button';
import { PriceBreakdown } from '@/components/PriceBreakdown';
import { Select } from '@/components/Select';

type PaymentMethod = 'cash' | 'bank_transfer' | 'card_provider';

export interface ReviewLabels {
  title: string;
  recap: string;
  checkIn: string;
  checkOut: string;
  guests: string;
  policy: string;
  policyConsent: string;
  verificationNote: string;
  paymentMethod: string;
  payCash: string;
  payCard: string;
  payTransfer: string;
  confirm: string;
  confirming: string;
  back: string;
  error: string;
  conflictTitle: string;
  conflictBody: string;
  searchAgain: string;
  categoryNote: string;
  total: string;
  nights: string;
  discountLongStay: string;
  discountEarlyBird: string;
  cleaningFee: string;
  occupancyTax: string;
}

interface Breakdown {
  nights: number;
  subtotal: number;
  lengthOfStayDiscount: number;
  earlyBirdDiscount: number;
  cleaningFee: number;
  occupancyTax: number;
  total: number;
}

export default function BookingReviewClient({
  labels,
  methods,
  defaultPolicy,
  projectId: resolvedProjectId,
}: {
  labels: ReviewLabels;
  methods: PaymentMethod[];
  defaultPolicy: string;
  projectId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const unitId = searchParams?.get('unitId');
  const categoryKey = searchParams?.get('categoryKey');
  const projectId = searchParams?.get('projectId') || resolvedProjectId;
  const startDate = searchParams?.get('startDate');
  const endDate = searchParams?.get('endDate');
  const adults = Number(searchParams?.get('adults') || '1');
  const children = Number(searchParams?.get('children') || '0');
  const instantBook = searchParams?.get('instantBook') !== '0';

  const [headline, setHeadline] = useState(categoryKey || '');
  const [policyText] = useState(defaultPolicy);
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null);
  const [consented, setConsented] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(methods[0] || 'cash');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  const backHref = unitId
    ? `/units/${unitId}?${new URLSearchParams({
        startDate: startDate || '',
        endDate: endDate || '',
        adults: String(adults),
        children: String(children),
      })}`
    : `/search?${new URLSearchParams({
        startDate: startDate || '',
        endDate: endDate || '',
        adults: String(adults),
        children: String(children),
        ...(projectId ? { projectId } : {}),
      })}`;

  useEffect(() => {
    if (!unitId || !startDate || !endDate) return;
    const load = async () => {
      const unitRes = await fetch(`/api/units/${unitId}`);
      if (unitRes.ok) {
        const unit = await unitRes.json();
        setHeadline(unit.name);
        if (unit.projectId && !projectId) {
          /* projectId stays in the query for POST */
        }
      }
      const priceRes = await fetch('/api/pricing/breakdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitId,
          startDate,
          endDate,
          guestCount: adults + children,
        }),
      });
      if (priceRes.ok) {
        setBreakdown(await priceRes.json());
      }
    };
    load();
  }, [unitId, startDate, endDate, adults, children, projectId]);

  const canSubmit =
    Boolean(startDate && endDate && projectId && (unitId || categoryKey) && consented) &&
    (Boolean(categoryKey) || Boolean(breakdown));

  const handleConfirm = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    setConflict(false);
    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitId: unitId || undefined,
          categoryKey: categoryKey || undefined,
          projectId,
          startDate,
          endDate,
          adultsCount: adults,
          childrenCount: children,
          instantBook,
          paymentMethod,
        }),
      });
      if (response.status === 401) {
        const next = `/book/review?${searchParams?.toString() || ''}`;
        router.push(`/login?next=${encodeURIComponent(next)}`);
        return;
      }
      if (response.status === 409) {
        setConflict(true);
        return;
      }
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || labels.error);
      }
      const result = await response.json();
      if (result.checkout?.checkoutUrl) {
        router.push(result.checkout.checkoutUrl);
      } else {
        router.push('/trips');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.error);
    } finally {
      setSubmitting(false);
    }
  };

  const methodOptions = methods.map((method) => ({
    value: method,
    label:
      method === 'card_provider'
        ? labels.payCard
        : method === 'bank_transfer'
          ? labels.payTransfer
          : labels.payCash,
  }));

  return (
    <main className="min-h-screen bg-surface-ivory p-24 md:p-32">
      <div className="mx-auto max-w-2xl">
        <p className="mb-16">
          <Link href={backHref} className="font-semibold text-brand-andaman hover:underline">
            {labels.back}
          </Link>
        </p>
        <h1 className="mb-8 font-display text-display-xl font-semibold text-brand-deep">
          {labels.title}
        </h1>
        {headline && <p className="mb-24 text-body text-text-ink">{headline}</p>}

        <section className="mb-24 rounded-lg border border-border-line bg-surface-paper p-24">
          <h2 className="mb-16 font-display text-heading-3 text-brand-deep">{labels.recap}</h2>
          <dl className="space-y-12 text-body">
            <div className="flex justify-between gap-16">
              <dt className="text-text-stone">{labels.checkIn}</dt>
              <dd className="tabular-nums text-text-ink">{startDate}</dd>
            </div>
            <div className="flex justify-between gap-16">
              <dt className="text-text-stone">{labels.checkOut}</dt>
              <dd className="tabular-nums text-text-ink">{endDate}</dd>
            </div>
            <div className="flex justify-between gap-16">
              <dt className="text-text-stone">{labels.guests}</dt>
              <dd className="text-text-ink">{adults + children}</dd>
            </div>
          </dl>
          {categoryKey && !unitId && (
            <p className="mt-16 text-small text-text-stone">{labels.categoryNote}</p>
          )}
        </section>

        {breakdown && (
          <div className="mb-24 rounded-lg border border-border-line bg-surface-paper p-24">
            <PriceBreakdown
              totalLabel={labels.total}
              totalSatang={Math.round((breakdown.total || 0) * 100)}
              lines={[
                {
                  id: 'nights',
                  label: labels.nights.replace('{nights}', String(breakdown.nights)),
                  satang: Math.round((breakdown.subtotal || 0) * 100),
                },
                ...(breakdown.lengthOfStayDiscount > 0
                  ? [
                      {
                        id: 'los',
                        label: labels.discountLongStay,
                        satang: -Math.round(breakdown.lengthOfStayDiscount * 100),
                      },
                    ]
                  : []),
                ...(breakdown.earlyBirdDiscount > 0
                  ? [
                      {
                        id: 'early',
                        label: labels.discountEarlyBird,
                        satang: -Math.round(breakdown.earlyBirdDiscount * 100),
                      },
                    ]
                  : []),
                ...(breakdown.cleaningFee > 0
                  ? [
                      {
                        id: 'clean',
                        label: labels.cleaningFee,
                        satang: Math.round(breakdown.cleaningFee * 100),
                      },
                    ]
                  : []),
                ...(breakdown.occupancyTax > 0
                  ? [
                      {
                        id: 'tax',
                        label: labels.occupancyTax,
                        satang: Math.round(breakdown.occupancyTax * 100),
                      },
                    ]
                  : []),
              ]}
            />
          </div>
        )}

        <section className="mb-24 rounded-lg border border-border-line bg-surface-paper p-24">
          <h2 className="mb-8 font-display text-heading-3 text-brand-deep">{labels.policy}</h2>
          <p className="mb-16 text-body text-text-stone">{policyText}</p>
          <label className="flex items-start gap-12 text-body text-text-ink">
            <input
              type="checkbox"
              checked={consented}
              onChange={(event) => setConsented(event.target.checked)}
              className="mt-4"
            />
            <span>{labels.policyConsent}</span>
          </label>
        </section>

        <p className="mb-24 text-body text-text-stone">{labels.verificationNote}</p>

        <div className="mb-24">
          <Select
            label={labels.paymentMethod}
            value={paymentMethod}
            onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
            options={methodOptions}
          />
        </div>

        {conflict && (
          <div className="mb-16 rounded-lg border border-state-warning bg-state-warning-soft p-16">
            <p className="mb-8 text-body-strong text-text-ink">{labels.conflictTitle}</p>
            <p className="mb-12 text-small text-text-secondary">{labels.conflictBody}</p>
            <Link href={backHref} className="font-semibold text-brand-andaman hover:underline">
              {labels.searchAgain}
            </Link>
          </div>
        )}
        {error && !conflict && <p className="mb-16 text-small text-state-error">{error}</p>}

        <Button
          size="lg"
          onClick={handleConfirm}
          disabled={!canSubmit || submitting}
          isLoading={submitting}
          fullWidth
        >
          {labels.confirm}
        </Button>
      </div>
    </main>
  );
}
