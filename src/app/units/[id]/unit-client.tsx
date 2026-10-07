'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Counter } from '@/components/Counter';
import { MoneyAmount } from '@/components/MoneyAmount';
import { PriceBreakdown } from '@/components/PriceBreakdown';
import { UnitPhotoMosaic } from '@/components/UnitPhotoMosaic';
import { StayDatePicker } from '@/components/StayDatePicker';
import { useLocale } from '@/components/LocaleProvider';
import { LeadForm, type LeadFormLabels } from '@/components/LeadForm';

interface Unit {
  id: string;
  name: string;
  marketingTitle?: string | null;
  images?: string[];
  amenityKeys?: string[];
  description?: string | null;
  floor?: string | null;
  sizeSqm?: number | null;
  usableAreaSqm?: number | null;
  grossAreaSqm?: number | null;
  outdoorAreaSqm?: number | null;
  plotAreaSqm?: number | null;
  unitFeatures?: string[];
  views?: string[];
  viewLabels?: string[];
  featureLabels?: string[];
  baseNightlyThb: number;
  maxGuests?: number;
  minNights?: number;
  bedrooms?: number;
  bathrooms?: number;
  instantBook?: boolean;
  cancellationPolicyKey?: string;
  projectId: string;
  inventoryCategory?: { id: string; categoryKey: string; name: string } | null;
  /** Canonical category base rate, satang. */
  baseRateSatang?: number;
  project?: { id: string; name: string; slug?: string };
  photoScope?: 'exact_unit' | 'room_type';
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
  bookingTerms?: { cancellationSteps?: Array<{ days: number; pct: number }> };
}

export interface UnitDetailLabels {
  loading: string;
  notFound: string;
  backToResults: string;
  onMyUno: string;
  showAllPhotos: string;
  photosPending: string;
  representativeMedia: string;
  guestsCount: string;
  bedroomsCount: string;
  minNightsCount: string;
  sizeUnit: string;
  floor: string;
  notChargedYet: string;
  fewerGuests: string;
  moreGuests: string;
  checkIn: string;
  checkOut: string;
  maxGuests: string;
  minStay: string;
  nights: string;
  night: string;
  bedrooms: string;
  bathrooms: string;
  cancellationPolicy: string;
  perNight: string;
  averageForDates: string;
  baseRateNote: string;
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
  unavailableForDates: string;
  leaseRequiredTitle: string;
  leaseRequiredBody: string;
  leaseRequestMessage: string;
  leadForm: LeadFormLabels;
  conflictTitle: string;
  conflictBody: string;
  searchAgain: string;
  amenitiesTitle: string;
  amenityLabels: Record<string, string>;
  policyLabels: Record<string, string>;
}

/** Lead pipeline for 12-month lease requests (ruling 2026-10-06). */
const LEASE_LEAD_AUDIENCE = 'renters' as const;

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
  const locale = useLocale();
  const pickerLabels = {
    ru: { previous: 'Назад', next: 'Вперёд', close: 'Закрыть', clear: 'Очистить' },
    th: { previous: 'ก่อนหน้า', next: 'ถัดไป', close: 'ปิด', clear: 'ล้าง' },
    zh: { previous: '上个月', next: '下个月', close: '关闭', clear: '清除' },
    en: { previous: 'Previous', next: 'Next', close: 'Close', clear: 'Clear' },
  };
  const pickerCopy = pickerLabels[locale as keyof typeof pickerLabels] ?? pickerLabels.en;
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [unit, setUnit] = useState<Unit | null>(null);
  const [breakdown, setBreakdown] = useState<PriceBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leaseRequired, setLeaseRequired] = useState(false);
  const [bookingType, setBookingType] = useState<'instant' | 'request'>('instant');

  const startDate = searchParams?.get('startDate');
  const endDate = searchParams?.get('endDate');
  const adults = parseInt(searchParams?.get('adults') || '1');
  const children = parseInt(searchParams?.get('children') || '0');

  const backToSearch = `/search?${searchParams?.toString() || ''}`;

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
    const controller = new AbortController();
    setBreakdown(null);
    setError(null);
    setLeaseRequired(false);
    const fetchBreakdown = async () => {
      if (!unit || !startDate || !endDate || endDate <= startDate) return;
      // A quote belongs to one set of dates: never leave the previous
      // price (and an enabled Reserve) beside a failure for new dates.
      setBreakdown(null);
      setError(null);
      setLeaseRequired(false);

      try {
        const response = await fetch('/api/pricing/breakdown', {
          signal: controller.signal,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            unitId: unit.id,
            startDate,
            endDate,
            guestCount: adults + children,
          }),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => null) as { code?: string } | null;
          if (body?.code === 'lease_request_required') {
            if (!controller.signal.aborted) setLeaseRequired(true);
            return;
          }
          throw new Error(body?.code === 'stay_unquotable' ? labels.unavailableForDates : labels.errorPrice);
        }
        const data = await response.json();
        if (!controller.signal.aborted) setBreakdown(data);
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : labels.errorPrice);
      }
    };

    fetchBreakdown();
    return () => controller.abort();
  }, [unit, startDate, endDate, adults, children, labels.errorPrice, labels.unavailableForDates]);

  const setAdults = (next: number) => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    setBreakdown(null);
    params.set('adults', String(next));
    router.replace(`${pathname}?${params.toString()}`);
  };

  const goToReview = () => {
    if (!startDate || !endDate || !unit) return;
    const next = new URLSearchParams({
      unitId: unit.id,
      projectId: unit.projectId,
      startDate,
      endDate,
      adults: String(adults),
      children: String(children),
      instantBook: bookingType === 'instant' ? '1' : '0',
    });
    router.push(`/book/review?${next.toString()}`);
  };

  // A source tariff that cancels by arrival season binds the booking to that
  // season's ladder (ruling 2026-10-06), so the dated quote wins over the
  // property-wide default fetched before dates were known.
  const policyKey = breakdown?.bookingTerms?.cancellationSteps
    ? 'season' : unit?.cancellationPolicyKey;

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-mint p-32">
        <p className="text-body text-text-secondary text-center">{labels.loading}</p>
      </div>
    );
  }

  if (!unit) {
    return (
      <div className="min-h-screen bg-surface-mint p-32">
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
    <div className="stitch-workspace p-16 pb-96 md:p-32 lg:pb-32">
      <div className="mx-auto max-w-content">
        <p className="mb-20 inline-flex rounded-full border border-border-line bg-surface-paper px-16 py-8 shadow-card">
          <Link
            href={backToSearch}
            className="text-brand-andaman font-semibold hover:underline"
          >
            {labels.backToResults}
          </Link>
        </p>
        <div className="grid grid-cols-1 gap-32 lg:grid-cols-[minmax(0,1.7fr)_minmax(340px,0.8fr)] lg:gap-48">
          <div className="lg:col-span-2">
            <UnitPhotoMosaic
              images={unit.images ?? []}
              alt={unit.name}
              showAllLabel={fill(labels.showAllPhotos, { count: unit.images?.length ?? 0 })}
              emptyLabel={labels.photosPending}
            />
            {unit.photoScope === 'room_type' ? (
              <p className="mt-8 text-small text-text-secondary">
                {labels.representativeMedia}
              </p>
            ) : null}
            <div className="stitch-panel mt-32 p-20 md:p-32">
              <h1 className="font-display text-display font-semibold tracking-[-0.02em] text-brand-deep mb-4">
                {unit.name}
              </h1>
              {unit.marketingTitle ? (
                <p className="mb-12 max-w-3xl font-display text-heading-3 font-semibold text-brand-andaman">
                  {unit.marketingTitle}
                </p>
              ) : null}
              {unit.project?.name && (
                <p className="text-body text-text-stone mb-20">
                  {unit.inventoryCategory?.name ? <><span className="font-medium text-text-ink">{unit.inventoryCategory.name}</span>{' · '}</> : null}
                  {unit.project.slug ? <Link href={`/projects/${unit.project.slug}?${searchParams?.toString() || ''}`} className="text-brand-andaman hover:underline">{unit.project.name}</Link> : unit.project.name}{' '}
                  <span className="text-text-stone-2">· {labels.onMyUno}</span>
                </p>
              )}
              <div className="flex flex-wrap gap-12 mb-20">
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
                {(unit.grossAreaSqm || unit.sizeSqm) ? (
                  <Chip variant="neutral">
                    {String(unit.grossAreaSqm || unit.sizeSqm)} {labels.sizeUnit}
                  </Chip>
                ) : null}
                {unit.floor ? <Chip variant="neutral">{fill(labels.floor, { value: unit.floor })}</Chip> : null}
              </div>
              {(unit.viewLabels?.length || unit.featureLabels?.length) ? (
                <div className="mb-24 flex flex-wrap gap-8">
                  {[...(unit.viewLabels ?? []), ...(unit.featureLabels ?? [])].map((fact) => (
                    <span key={fact} className="rounded-full border border-brand-sun/40 bg-surface-sand px-12 py-8 text-small text-text-ink">
                      {fact}
                    </span>
                  ))}
                </div>
              ) : null}
              {unit.description ? (
                <p className="text-body text-text-ink mb-32 max-w-[720px] leading-relaxed">
                  {unit.description}
                </p>
              ) : null}
              {unit.amenityKeys && unit.amenityKeys.length > 0 && (
                <div className="stitch-panel-soft mb-32 p-20">
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
              {/* The resolved policy the booking will snapshot. No policy
                  resolved = no claim: never a "flexible" placeholder. */}
              {policyKey && (
                <>
                  <p className="font-display text-kicker uppercase text-brand-sun mb-16">
                    {labels.cancellationPolicy}
                  </p>
                  <p className="text-body text-text-stone mb-32">
                    {labels.policyLabels[policyKey] || policyKey}
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="stitch-panel sticky top-96 p-24 shadow-float">
              <div className="flex items-baseline gap-8 mb-20">
                {/* The headline must match what the guest will be charged:
                    with dates it is the average night of the live quote
                    (breakdown is baht at this boundary); without dates it is
                    the canonical category base rate, labelled as such. It
                    used to show the legacy unit field (฿9,393) beside a
                    quote of ฿13,006/night. */}
                <MoneyAmount
                  satang={
                    breakdown && breakdown.nights > 0
                      ? Math.round((breakdown.subtotal * 100) / breakdown.nights)
                      : unit.baseRateSatang ?? unit.baseNightlyThb ?? 0
                  }
                  className="text-display font-semibold"
                />
                <span className="text-body text-text-stone">{labels.perNight}</span>
              </div>
              <p className="-mt-12 mb-20 text-small text-text-stone">
                {breakdown && breakdown.nights > 0 ? labels.averageForDates : labels.baseRateNote}
              </p>

              <div className="mb-20">
                <StayDatePicker start={startDate || ''} end={endDate || ''}
                  min={new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })}
                  locale={locale} labels={{ checkIn: labels.checkIn, checkOut: labels.checkOut, ...pickerCopy }}
                  onChange={(start, end) => {
                    setBreakdown(null);
                    const next = new URLSearchParams(searchParams?.toString() || '');
                    if (start) next.set('startDate', start); else next.delete('startDate');
                    if (end) next.set('endDate', end); else next.delete('endDate');
                    router.replace(`${pathname}?${next}`, { scroll: false });
                  }} />
              </div>
              {!startDate || !endDate ? (
                <p className="text-body text-text-stone mb-24">{labels.pickDates}</p>
              ) : (
                <div className="mb-20 overflow-hidden rounded-md border border-border-line bg-surface-sand/60">
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

              {leaseRequired && startDate && endDate ? (
                <div>
                  <p className="font-display text-title font-semibold mb-8">{labels.leaseRequiredTitle}</p>
                  <p className="text-body text-text-stone mb-16">{labels.leaseRequiredBody}</p>
                  <LeadForm
                    audience={LEASE_LEAD_AUDIENCE}
                    projectId={unit.projectId}
                    initialMessage={fill(labels.leaseRequestMessage, {
                      unit: unit.name, start: startDate, end: endDate, guests: adults + children,
                    })}
                    labels={labels.leadForm}
                  />
                </div>
              ) : (
              <>
              <p className="text-small text-text-stone mb-16">
                {bookingType === 'instant' ? labels.instantBook : labels.requestToBook}
              </p>

              {error && (
                <div className="bg-state-error/10 border border-state-error rounded-md p-12 mb-16">
                  <p className="text-small text-state-error">{error}</p>
                </div>
              )}

              <Button
                size="lg"
                onClick={goToReview}
                disabled={!breakdown}
                fullWidth
              >
                {labels.reserve}
              </Button>
              <p className="text-small text-text-stone text-center mt-12 mb-0">
                {labels.notChargedYet}
              </p>
              </>
              )}
            </div>
          </div>
        </div>
      </div>
      {breakdown && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-16 border-t border-border-line bg-surface-paper/95 px-16 py-12 shadow-float backdrop-blur-xl lg:hidden">
          <MoneyAmount
            satang={Math.round((breakdown.total || 0) * 100)}
            className="text-title font-semibold"
          />
          <Button
            onClick={goToReview}
          >
            {labels.reserve}
          </Button>
        </div>
      )}
    </div>
  );
}
