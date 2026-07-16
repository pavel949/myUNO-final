'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Button } from '@/components/Button';

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
  amenitiesTitle: string;
  amenityLabels: Record<string, string>;
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
  const [bookingType, setBookingType] = useState<'instant' | 'request'>('instant');
  const [guestNote, setGuestNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card_provider'>('cash');
  const [submitting, setSubmitting] = useState(false);

  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const adults = parseInt(searchParams.get('adults') || '1');
  const children = parseInt(searchParams.get('children') || '0');

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

  const handleBooking = async () => {
    if (!startDate || !endDate || !breakdown || !unit) return;

    setSubmitting(true);
    setError(null);

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
        const next = `${pathname}?${searchParams.toString()}`;
        router.push(`/login?next=${encodeURIComponent(next)}`);
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
      <div className="min-h-screen bg-surface-background p-32">
        <p className="text-body text-text-secondary text-center">{labels.loading}</p>
      </div>
    );
  }

  if (!unit) {
    return (
      <div className="min-h-screen bg-surface-background p-32">
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
    <div className="min-h-screen bg-surface-background p-24 md:p-32">
      <div className="max-w-6xl mx-auto">
        <p className="mb-16">
          <Link
            href={backToSearch}
            className="text-brand-andaman font-semibold hover:underline"
          >
            {labels.backToResults}
          </Link>
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-32">
          {/* Unit details */}
          <div className="lg:col-span-2">
            <div className="bg-surface-paper border border-border-line rounded-lg overflow-hidden mb-32">
              {unit.images && unit.images.length > 0 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={unit.images[0]}
                  alt={unit.name}
                  className="aspect-video w-full object-cover"
                />
              ) : (
                <div className="aspect-video bg-gradient-to-br from-brand-andaman to-brand-andaman-dark" />
              )}
              {unit.images && unit.images.length > 1 && (
                <div className="grid grid-cols-4 gap-4 p-8">
                  {unit.images.slice(1, 5).map((image) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={image}
                      src={image}
                      alt={unit.name}
                      className="aspect-video w-full object-cover rounded-sm"
                    />
                  ))}
                </div>
              )}
              <div className="p-24">
                <h1 className="text-heading-1 font-bold text-text-ink mb-8">{unit.name}</h1>
                {unit.project?.name && (
                  <p className="text-small text-text-secondary mb-8">{unit.project.name}</p>
                )}
                <p className="text-body text-text-secondary mb-24">
                  {unit.description || labels.defaultDescription}
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-16 mb-24">
                  <div className="border-t border-border-line pt-16">
                    <p className="text-small text-text-secondary">{labels.maxGuests}</p>
                    <p className="text-heading-3 font-semibold text-text-ink">
                      {unit.maxGuests || '2+'}
                    </p>
                  </div>
                  <div className="border-t border-border-line pt-16">
                    <p className="text-small text-text-secondary">{labels.minStay}</p>
                    <p className="text-heading-3 font-semibold text-text-ink">
                      {unit.minNights || 1}{' '}
                      {(unit.minNights || 1) === 1 ? labels.night : labels.nights}
                    </p>
                  </div>
                  {unit.bedrooms !== undefined && (
                    <div className="border-t border-border-line pt-16">
                      <p className="text-small text-text-secondary">{labels.bedrooms}</p>
                      <p className="text-heading-3 font-semibold text-text-ink">
                        {unit.bedrooms}
                      </p>
                    </div>
                  )}
                  {unit.bathrooms !== undefined && (
                    <div className="border-t border-border-line pt-16">
                      <p className="text-small text-text-secondary">{labels.bathrooms}</p>
                      <p className="text-heading-3 font-semibold text-text-ink">
                        {unit.bathrooms}
                      </p>
                    </div>
                  )}
                </div>
                {unit.amenityKeys && unit.amenityKeys.length > 0 && (
                  <div className="mb-24">
                    <p className="text-small font-semibold text-text-ink mb-8">
                      {labels.amenitiesTitle}
                    </p>
                    <div className="flex flex-wrap gap-8">
                      {unit.amenityKeys.map((key) => (
                        <span
                          key={key}
                          className="px-12 py-4 rounded-full bg-surface-background border border-border-line text-small text-text-ink"
                        >
                          {labels.amenityLabels[key] || key}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="bg-surface-background rounded-lg p-16">
                  <p className="text-small font-semibold text-text-ink mb-8">
                    {labels.cancellationPolicy}
                  </p>
                  <p className="text-body text-text-secondary">
                    {unit.cancellationPolicyKey || labels.cancellationDefault}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Booking widget */}
          <div className="lg:col-span-1">
            <div className="bg-surface-paper border border-border-line rounded-lg p-24 sticky top-96">
              <h2 className="text-heading-2 font-bold text-text-ink mb-24">
                ฿{unit.baseNightlyThb?.toLocaleString()} {labels.perNight}
              </h2>

              {!startDate || !endDate ? (
                <p className="text-body text-text-secondary mb-24">{labels.pickDates}</p>
              ) : null}

              {breakdown && (
                <div className="space-y-12 mb-24 pb-24 border-b border-border-line">
                  <div className="flex justify-between text-small">
                    <span className="text-text-secondary">
                      ฿{breakdown.nightlyRate?.toLocaleString()}{' '}
                      {fill(labels.priceNights, { nights: breakdown.nights })}
                    </span>
                    <span className="text-text-ink font-semibold">
                      ฿{breakdown.subtotal?.toLocaleString()}
                    </span>
                  </div>
                  {breakdown.lengthOfStayDiscount > 0 && (
                    <div className="flex justify-between text-small">
                      <span className="text-text-secondary">{labels.discountLongStay}</span>
                      <span className="text-state-success font-semibold">
                        -฿{breakdown.lengthOfStayDiscount?.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {breakdown.cleaningFee > 0 && (
                    <div className="flex justify-between text-small">
                      <span className="text-text-secondary">{labels.cleaningFee}</span>
                      <span className="text-text-ink font-semibold">
                        ฿{breakdown.cleaningFee?.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {breakdown.occupancyTax > 0 && (
                    <div className="flex justify-between text-small">
                      <span className="text-text-secondary">{labels.occupancyTax}</span>
                      <span className="text-text-ink font-semibold">
                        ฿{breakdown.occupancyTax?.toLocaleString()}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-subtitle font-bold">
                    <span className="text-text-ink">{labels.total}</span>
                    <span className="text-brand-andaman">
                      ฿{breakdown.total?.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              <div className="mb-24">
                <label
                  htmlFor="booking-type"
                  className="block text-small font-semibold text-text-ink mb-8"
                >
                  {labels.bookingType}
                </label>
                <select
                  id="booking-type"
                  value={bookingType}
                  onChange={(e) => setBookingType(e.target.value as 'instant' | 'request')}
                  className="w-full h-48 px-12 border border-border-line rounded-sm text-body bg-surface-paper text-text-ink"
                >
                  {unit.instantBook !== false && (
                    <option value="instant">{labels.instantBook}</option>
                  )}
                  <option value="request">{labels.requestToBook}</option>
                </select>
              </div>

              <div className="mb-24">
                <label
                  htmlFor="payment-method"
                  className="block text-small font-semibold text-text-ink mb-8"
                >
                  {labels.paymentMethod}
                </label>
                <select
                  id="payment-method"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as 'cash' | 'card_provider')}
                  className="w-full h-48 px-12 border border-border-line rounded-sm text-body bg-surface-paper text-text-ink"
                >
                  <option value="cash">{labels.payCash}</option>
                  <option value="card_provider">{labels.payCard}</option>
                </select>
              </div>

              <div className="mb-24">
                <label
                  htmlFor="guest-note"
                  className="block text-small font-semibold text-text-ink mb-8"
                >
                  {labels.guestNote}
                </label>
                <textarea
                  id="guest-note"
                  value={guestNote}
                  onChange={(e) => setGuestNote(e.target.value)}
                  className="w-full px-12 py-12 border border-border-line rounded-sm text-body bg-surface-paper text-text-ink"
                  rows={3}
                  placeholder={labels.guestNotePlaceholder}
                />
              </div>

              {error && (
                <div className="bg-state-error/10 border border-state-error rounded-lg p-12 mb-16">
                  <p className="text-small text-state-error">{error}</p>
                </div>
              )}

              <Button
                onClick={handleBooking}
                disabled={submitting || !breakdown}
                isLoading={submitting}
                fullWidth
              >
                {labels.reserve}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
