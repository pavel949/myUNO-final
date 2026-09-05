'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Counter } from '@/components/Counter';
import { MoneyAmount } from '@/components/MoneyAmount';
import { PriceBreakdown } from '@/components/PriceBreakdown';
import { Select } from '@/components/Select';
import { Textarea } from '@/components/Textarea';
import { UnitPhotoMosaic } from '@/components/UnitPhotoMosaic';

interface Unit {
  id: string;
  name: string;
  images?: string[];
  amenityKeys?: string[];
  description?: string;
  baseNightlyThb: number;
  maxGuests?: number;
  minNights?: number;
  bedrooms?: number;
  bathrooms?: number;
  instantBook?: boolean;
  cancellationPolicyKey?: string;
  projectId: string;
  project?: { id: string; name: string };
}

interface PriceBreakdown {
  nights: number;
  nightlyRate: number;
  subtotal: number;
  lengthOfStayDiscount: number;
  earlyBirdDiscount: number;
  cleaningFee: number;
  subtotalAfterFees: number;
  serviceFee: number;
  occupancyTax: number;
  total: number;
}

export interface UnitDetailLabels {
  loading: string;
  notFound: string;
  backToResults: string;
  onMyUno: string;
  showAllPhotos: string;
  guestsCount: string;
  bedroomsCount: string;
  minNightsCount: string;
  notChargedYet: string;
  fewerGuests: string;
  moreGuests: string;
  checkIn: string;
  checkOut: string;
  defaultDescription: string;
  maxGuests: string;
  minStay: string;
  nights: string;
  night: string;
  bedrooms: string;
  bathrooms: string;
  cancellationPolicy: string;
  cancellationDefault: string;
  perNight: string;
  priceNights: string;
  discountLongStay: string;
  discountEarlyBird: string;
  cleaningFee: string;
  occupancyTax: string;
  total: string;
  bookingType: string;
  instantBook: string;
  requestToBook: string;
  guestNote: string;
  guestNotePlaceholder: string;
  paymentMethod: string;
  payCash: string;
  payCard: string;
  reserve: string;
  reserving: string;
  pickDates: string;
  errorPrice: string;
  errorBooking: string;
  conflictTitle: string;
  conflictBody: string;
  searchAgain: string;
  amenitiesTitle: string;
  amenityLabels: Record<string, string>;
  policyLabels: Record<string, string>;
}

function fill(template: string, params: Record<string, string | number>): string {
  let result = template;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
  }
  return result;
}

export default function UnitDetailClient({
  unitId,
  labels,
}: {
  unitId: string;
  labels: UnitDetailLabels;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [unit, setUnit] = useState<Unit | null>(null);
  const [breakdown, setBreakdown] = useState<PriceBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [datesConflict, setDatesConflict] = useState(false);
  const [bookingType, setBookingType] = useState<'instant' | 'request'>('instant');
  const [guestNote, setGuestNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card_provider'>('cash');
  const [submitting, setSubmitting] = useState(false);

  const startDate = searchParams?.get('startDate');
  const endDate = searchParams?.get('endDate');
  const adults = parseInt(searchParams?.get('adults') || '1');
  const children = parseInt(searchParams?.get('children') || '0');

  const backToSearch = `/search?${new URLSearchParams({
    startDate: startDate || '',
    endDate: endDate || '',
    adults: String(adults),
    children: String(children),
  })}`;

  useEffect(() => {
    const fetchUnit = async () => {
      try {
        const response = await fetch(`/api/units/${unitId}`);
        if (!response.ok) throw new Error(labels.notFound);
        const data = await response.json();
        setUnit(data);
        if (data.instantBook === false) {
          setBookingType('request');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : labels.notFound);
      } finally {
        setLoading(false);
      }
    };

    fetchUnit();
  }, [unitId, labels.notFound]);

  useEffect(() => {
    const fetchBreakdown = async () => {
      if (!unit || !startDate || !endDate) return;

      try {
        const response = await fetch('/api/pricing/breakdown', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            unitId: unit.id,
            startDate,
            endDate,
            guestCount: adults + children,
          }),
        });

        if (!response.ok) throw new Error(labels.errorPrice);
        const data = await response.json();
        setBreakdown(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : labels.errorPrice);
      }
    };

    fetchBreakdown();
  }, [unit, startDate, endDate, adults, children, labels.errorPrice]);

  const setAdults = (next: number) => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    params.set('adults', String(next));
    router.replace(`${pathname}?${params.toString()}`);
  };

  const handleBooking = async () => {
    if (!startDate || !endDate || !breakdown || !unit) return;

    setSubmitting(true);
    setError(null);
    setDatesConflict(false);

    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitId: unit.id,
          projectId: unit.projectId,
          startDate,
          endDate,
          adultsCount: adults,
          childrenCount: children,
          instantBook: bookingType === 'instant',
          guestNote: guestNote || undefined,
          paymentMethod,
        }),
      });

      if (response.status === 401) {
        const next = `${pathname}?${searchParams?.toString() || ''}`;
        router.push(`/login?next=${encodeURIComponent(next)}`);
        return;
      }

      if (response.status === 409) {
        setDatesConflict(true);
        return;
      }

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || labels.errorBooking);
      }

      const result = await response.json();

      if (result.checkout) {
        router.push(result.checkout.checkoutUrl);
      } else {
        router.push('/trips');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.errorBooking);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-ivory p-32">
        <p className="text-body text-text-secondary text-center">{labels.loading}</p>
      </div>
    );
  }

  if (!unit) {
    return (
      <div className="min-h-screen bg-surface-ivory p-32">
        <div className="max-w-4xl mx-auto">
          <div className="bg-state-error/10 border border-state-error rounded-lg p-16">
            <p className="text-body text-state-error">{error || labels.notFound}</p>
          </div>
          <p className="mt-16">
            <Link href="/search" className="text-brand-andaman font-semibold hover:underline">
              {labels.backToResults}
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-ivory p-16 md:p-32 pb-96 lg:pb-32">
      <div className="max-w-6xl mx-auto">
        <p className="mb-16">
          <Link
            href={backToSearch}
            className="text-brand-andaman font-semibold hover:underline"
          >
            {labels.backToResults}
          </Link>
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-40">
          <div className="lg:col-span-2">
            <UnitPhotoMosaic
              images={unit.images ?? []}
              alt={unit.name}
              showAllLabel={fill(labels.showAllPhotos, { count: unit.images?.length ?? 0 })}
            />
            <div className="mt-32">
              <h1 className="font-display text-display font-semibold text-text-ink mb-4">
                {unit.name}
              </h1>
              {unit.project?.name && (
                <p className="text-body text-text-stone mb-20">
                  {unit.project.name}{' '}
                  <span className="text-text-stone-2">· {labels.onMyUno}</span>
                </p>
              )}
              <div className="flex flex-wrap gap-12 mb-32">
                <Chip variant="neutral">
                  {fill(labels.guestsCount, { count: unit.maxGuests || 2 })}
                </Chip>
                {unit.bedrooms !== undefined && (
                  <Chip variant="neutral">
                    {fill(labels.bedroomsCount, { count: unit.bedrooms })}
                  </Chip>
                )}
                <Chip variant="neutral">
                  {fill(labels.minNightsCount, { count: unit.minNights || 1 })}
                </Chip>
                {unit.amenityKeys?.slice(0, 3).map((key) => (
                  <Chip key={key} variant="neutral">
                    {labels.amenityLabels[key] || key}
                  </Chip>
                ))}
              </div>
              <p className="text-body text-text-ink mb-32 max-w-[620px]">
                {unit.description || labels.defaultDescription}
              </p>
              {unit.amenityKeys && unit.amenityKeys.length > 0 && (
                <div className="mb-32">
                  <p className="font-display text-kicker uppercase text-brand-sun mb-16">
                    {labels.amenitiesTitle}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                    {unit.amenityKeys.map((key) => (
                      <p key={key} className="text-body text-text-ink m-0">
                        {labels.amenityLabels[key] || key}
                      </p>
                    ))}
                  </div>
                </div>
              )}
              <p className="font-display text-kicker uppercase text-brand-sun mb-16">
                {labels.cancellationPolicy}
              </p>
              <p className="text-body text-text-stone mb-32">
                {(unit.cancellationPolicyKey && labels.policyLabels[unit.cancellationPolicyKey]) ||
                  unit.cancellationPolicyKey ||
                  labels.cancellationDefault}
              </p>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-surface-paper border border-border-line rounded-lg p-24 sticky top-96 shadow-card">
              <div className="flex items-baseline gap-8 mb-20">
                <MoneyAmount
                  satang={Math.round((unit.baseNightlyThb || 0) * 100)}
                  className="text-display font-semibold"
                />
                <span className="text-body text-text-stone">{labels.perNight}</span>
              </div>

              {!startDate || !endDate ? (
                <p className="text-body text-text-stone mb-24">{labels.pickDates}</p>
              ) : (
                <div className="border border-border-line rounded-sm mb-20">
                  <div className="grid grid-cols-2">
                    <div className="p-12 border-r border-border-line">
                      <p className="text-small text-text-stone m-0 mb-4">{labels.checkIn}</p>
                      <p className="font-display text-body font-medium tabular-nums m-0">{startDate}</p>
                    </div>
                    <div className="p-12">
                      <p className="text-small text-text-stone m-0 mb-4">{labels.checkOut}</p>
                      <p className="font-display text-body font-medium tabular-nums m-0">{endDate}</p>
                    </div>
                  </div>
                  <div className="p-12 border-t border-border-line flex items-center justify-between">
                    <p className="text-body font-medium m-0">
                      {fill(labels.guestsCount, { count: adults + children })}
                    </p>
                    <Counter
                      value={adults}
                      onChange={setAdults}
                      min={1}
                      max={unit.maxGuests || 8}
                      decreaseLabel={labels.fewerGuests}
                      increaseLabel={labels.moreGuests}
                    />
                  </div>
                </div>
              )}

              {breakdown && (
                <div className="mb-20">
                  <PriceBreakdown
                    totalLabel={labels.total}
                    totalSatang={Math.round((breakdown.total || 0) * 100)}
                    lines={[
                      {
                        id: 'nights',
                        label: fill(labels.priceNights, { nights: breakdown.nights }),
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

              <p className="text-small text-text-stone mb-16">
                {bookingType === 'instant' ? labels.instantBook : labels.requestToBook}
              </p>

              <div className="mb-16">
                <Select
                  label={labels.paymentMethod}
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as 'cash' | 'card_provider')}
                  options={[
                    { value: 'cash', label: labels.payCash },
                    { value: 'card_provider', label: labels.payCard },
                  ]}
                />
              </div>

              <div className="mb-20">
                <Textarea
                  label={labels.guestNote}
                  value={guestNote}
                  onChange={(e) => setGuestNote(e.target.value)}
                  placeholder={labels.guestNotePlaceholder}
                />
              </div>

              {datesConflict ? (
                <div className="bg-state-warning-soft border border-state-warning rounded-lg p-16 mb-16">
                  <h3 className="text-body-strong text-text-ink mb-8">
                    {labels.conflictTitle}
                  </h3>
                  <p className="text-small text-text-secondary mb-12">{labels.conflictBody}</p>
                  <Link href={backToSearch}>
                    <Button variant="secondary" size="sm">
                      {labels.searchAgain}
                    </Button>
                  </Link>
                </div>
              ) : null}

              {error && !datesConflict && (
                <div className="bg-state-error/10 border border-state-error rounded-lg p-12 mb-16">
                  <p className="text-small text-state-error">{error}</p>
                </div>
              )}

              <Button
                size="lg"
                onClick={handleBooking}
                disabled={submitting || !breakdown}
                isLoading={submitting}
                fullWidth
              >
                {labels.reserve}
              </Button>
              <p className="text-small text-text-stone text-center mt-12 mb-0">
                {labels.notChargedYet}
              </p>
            </div>
          </div>
        </div>
      </div>
      {breakdown && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-surface-paper border-t border-border-line px-16 py-12 flex items-center justify-between gap-16">
          <MoneyAmount
            satang={Math.round((breakdown.total || 0) * 100)}
            className="text-title font-semibold"
          />
          <Button
            onClick={handleBooking}
            disabled={submitting}
            isLoading={submitting}
          >
            {labels.reserve}
          </Button>
        </div>
      )}
    </div>
  );
}
