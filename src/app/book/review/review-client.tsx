'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/Button';
import { PriceBreakdown } from '@/components/PriceBreakdown';
import { PageHeading } from '@/components/premium/StitchPage';
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
  requote: string;
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
  const inventoryCategoryId =
    searchParams?.get('inventoryCategoryId') || searchParams?.get('categoryId');
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
  const [categoryQuoteToken, setCategoryQuoteToken] = useState<string | null>(null);
  const [acceptedTotalSatang, setAcceptedTotalSatang] = useState<number | null>(null);
  const [consented, setConsented] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(methods[0] || 'cash');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [creationKey, setCreationKey] = useState<string | null>(null);
  const [quoteRevision, setQuoteRevision] = useState(0);
  const [quotedStay, setQuotedStay] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const stayKey = JSON.stringify([unitId, inventoryCategoryId, projectId, startDate, endDate, adults, children]);
  const reviewQuery = searchParams?.toString() || '';
  const creationQueryRef = useRef<{ query: string; key: string } | null>(null);

  useEffect(() => {
    const query = new URLSearchParams(reviewQuery);
    const incoming = query.get('bookingIntent');
    if (!incoming || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(incoming)) {
      // Preserve this attempt across refresh, back navigation and login.
      // A fresh listing link starts a new intent.
      const key = creationQueryRef.current?.query === reviewQuery
        ? creationQueryRef.current.key : crypto.randomUUID();
      creationQueryRef.current = { query: reviewQuery, key };
      setCreationKey(key);
      query.set('bookingIntent', key);
      router.replace(`/book/review?${query}`, { scroll: false });
      return undefined;
    }
    setCreationKey(incoming);
    const controller = new AbortController();
    fetch(`/api/bookings?idempotencyKey=${encodeURIComponent(incoming)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return;
        const result = await response.json();
        if (!controller.signal.aborted && result.booking?.id) router.push(`/trips/${result.booking.id}`);
      })
      .catch(() => { /* A keyed POST can still recover a committed attempt. */ });
    return () => controller.abort();
  }, [reviewQuery, router]);

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
        ...(inventoryCategoryId ? { inventoryCategoryId } : {}),
        ...(!inventoryCategoryId && categoryKey ? { categoryKey } : {}),
      })}`;

  useEffect(() => {
    if (inventoryCategoryId && !unitId && startDate && endDate) {
      const controller = new AbortController();
      const loadCategoryQuote = async () => {
        setConsented(false);
        setQuotedStay(null);
        setBreakdown(null);
        setCategoryQuoteToken(null);
        setAcceptedTotalSatang(null);
        const response = await fetch('/api/pricing/category-quote', {
          method: 'POST',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            inventoryCategoryId,
            startDate,
            endDate,
            adultsCount: Math.max(1, adults),
            childrenCount: Math.max(0, children),
          }),
        });
        if (!response.ok) throw new Error(labels.error);
        const data = await response.json();
        if (controller.signal.aborted) return;
        if (!Number.isSafeInteger(data.acceptedTotalSatang) || data.acceptedTotalSatang < 0) {
          throw new Error(labels.error);
        }
        if (data.categoryName) setHeadline(data.categoryName);
        setBreakdown(data.breakdown);
        setCategoryQuoteToken(data.quoteToken);
        setAcceptedTotalSatang(data.acceptedTotalSatang);
        setQuotedStay(stayKey);
      };
      loadCategoryQuote().catch(() => {
        if (!controller.signal.aborted) setError(labels.error);
      });
      return () => controller.abort();
    }
    return undefined;
  }, [inventoryCategoryId, unitId, startDate, endDate, adults, children, quoteRevision, stayKey, labels.error]);

  useEffect(() => {
    if (!unitId || !startDate || !endDate) return;
    const controller = new AbortController();
    setConsented(false);
    setQuotedStay(null);
    setBreakdown(null);
    setAcceptedTotalSatang(null);
    const load = async () => {
      const unitRes = await fetch(`/api/units/${unitId}`, { signal: controller.signal });
      if (unitRes.ok) {
        const unit = await unitRes.json();
        if (controller.signal.aborted) return;
        setHeadline(unit.name);
      }
      const priceRes = await fetch('/api/pricing/breakdown', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitId,
          startDate,
          endDate,
          guestCount: adults + children,
        }),
      });
      if (!priceRes.ok) throw new Error(labels.error);
      const quote = await priceRes.json();
      if (controller.signal.aborted) return;
      if (!Number.isSafeInteger(quote.acceptedTotalSatang) || quote.acceptedTotalSatang < 0) {
        throw new Error(labels.error);
      }
      setBreakdown(quote);
      setAcceptedTotalSatang(quote.acceptedTotalSatang);
      setQuotedStay(stayKey);
    };
    load().catch(() => {
      if (!controller.signal.aborted) setError(labels.error);
    });
    return () => controller.abort();
  }, [unitId, startDate, endDate, adults, children, quoteRevision, stayKey, labels.error]);

  const categorySelected = Boolean(inventoryCategoryId || categoryKey);
  const canSubmit =
    Boolean(startDate && endDate && projectId && (unitId || categorySelected) && consented) &&
    Boolean(breakdown) &&
    quotedStay === stayKey && acceptedTotalSatang !== null &&
    Boolean(creationKey) &&
    (Boolean(unitId) ||
      Boolean(inventoryCategoryId && categoryQuoteToken && acceptedTotalSatang !== null));

  const handleConfirm = async () => {
    if (!canSubmit || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    setConflict(false);
    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitId: unitId || undefined,
          inventoryCategoryId: inventoryCategoryId || undefined,
          categoryKey: !inventoryCategoryId ? categoryKey || undefined : undefined,
          projectId,
          startDate,
          endDate,
          adultsCount: adults,
          childrenCount: children,
          instantBook,
          paymentMethod,
          acceptedTotalSatang,
          idempotencyKey: creationKey,
          ...(inventoryCategoryId && !unitId
            ? {
                categoryQuoteToken,
              }
            : {}),
        }),
      });
      if (response.status === 401) {
        const nextQuery = new URLSearchParams(reviewQuery);
        if (creationKey) nextQuery.set('bookingIntent', creationKey);
        const next = `/book/review?${nextQuery}`;
        router.push(`/login?next=${encodeURIComponent(next)}`);
        return;
      }
      if (response.status === 409) {
        const body = await response.json().catch(() => null);
        if (body?.code === 'BOOKING_INTENT_CONFLICT') {
          setError(body.error || labels.error);
          return;
        }
        if (body?.code === 'REQUOTE_REQUIRED') {
          setConsented(false);
          setQuotedStay(null);
          setBreakdown(null);
          setCategoryQuoteToken(null);
          setAcceptedTotalSatang(null);
          setError(labels.requote);
          setQuoteRevision((revision) => revision + 1);
          return;
        }
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
      submittingRef.current = false;
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
    <main className="stitch-workspace px-20 py-24 md:px-32 md:py-32">
      <div className="mx-auto max-w-content">
        <p className="mb-16">
          <Link href={backHref} className="font-semibold text-brand-andaman hover:underline">
            {labels.back}
          </Link>
        </p>
        <PageHeading title={labels.title} subtitle={headline || undefined} />

        <div className="grid grid-cols-1 gap-24 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <div>
        <section className="mb-24 stitch-panel p-24">
          <h2 className="mb-16 font-display text-heading-3 text-text-ink">{labels.recap}</h2>
          <dl className="grid gap-12 rounded-md bg-surface-sand p-16 text-body sm:grid-cols-3">
            <div className="min-w-0 space-y-4">
              <dt className="text-small text-text-stone">{labels.checkIn}</dt>
              <dd className="tabular-nums text-text-ink">{startDate}</dd>
            </div>
            <div className="min-w-0 space-y-4">
              <dt className="text-small text-text-stone">{labels.checkOut}</dt>
              <dd className="tabular-nums text-text-ink">{endDate}</dd>
            </div>
            <div className="min-w-0 space-y-4">
              <dt className="text-small text-text-stone">{labels.guests}</dt>
              <dd className="text-text-ink">{adults + children}</dd>
            </div>
          </dl>
          {categorySelected && !unitId && (
            <p className="mt-16 text-small text-text-stone">{labels.categoryNote}</p>
          )}
        </section>

        <section className="mb-24 stitch-panel p-24">
          <h2 className="mb-8 font-display text-heading-3 text-text-ink">{labels.policy}</h2>
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
        </div>

        <aside className="lg:sticky lg:top-96">
        {breakdown && (
          <div className="mb-24 stitch-panel shadow-float p-24">
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
                  ? [{ id: 'los', label: labels.discountLongStay, satang: -Math.round(breakdown.lengthOfStayDiscount * 100) }]
                  : []),
                ...(breakdown.earlyBirdDiscount > 0
                  ? [{ id: 'early', label: labels.discountEarlyBird, satang: -Math.round(breakdown.earlyBirdDiscount * 100) }]
                  : []),
                ...(breakdown.cleaningFee > 0
                  ? [{ id: 'clean', label: labels.cleaningFee, satang: Math.round(breakdown.cleaningFee * 100) }]
                  : []),
                ...(breakdown.occupancyTax > 0
                  ? [{ id: 'tax', label: labels.occupancyTax, satang: Math.round(breakdown.occupancyTax * 100) }]
                  : []),
              ]}
            />
          </div>
        )}

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
        </aside>
        </div>
      </div>
    </main>
  );
}
