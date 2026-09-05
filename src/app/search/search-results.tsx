'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { SearchBar } from '@/components/SearchBar';

/** One screenful. Beyond this the guest asks for more rather than waiting for it. */
const PAGE_SIZE = 24;

interface Unit {
  id: string;
  name: string;
  baseNightlyThb: number;
  description?: string;
  projectId?: string;
  coverUrl?: string | null;
  /** Null when nobody has reviewed it — unknown, not zero. */
  averageRating?: number | null;
  reviewCount?: number;
}

interface CategoryCard {
  category_key: string;
  label: string;
  available_count: number;
  from_nightly_thb: number;
}

export interface SearchResultsLabels {
  title: string;
  resultsSummary: string;
  prompt: string;
  loading: string;
  errorGeneric: string;
  empty: string;
  emptyHint: string;
  perNight: string;
  showing: string;
  categoriesTitle: string;
  categoryAvailable: string;
  categoryFrom: string;
  categoryBook: string;
  categoryBooking: string;
  categoryAutoAssign: string;
  errorBooking: string;
  sortLabel: string;
  loadMore: string;
  loadingMore: string;
  ratingSummary: string;
  barCheckIn: string;
  barCheckOut: string;
  barAdults: string;
  barChildren: string;
  barSubmit: string;
}

function fill(template: string, params: Record<string, string | number>): string {
  let result = template;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
  }
  return result;
}

export interface SortOption {
  key: string;
  label: string;
}

export default function SearchResults({
  labels,
  sortOptions,
}: {
  labels: SearchResultsLabels;
  sortOptions: SortOption[];
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [units, setUnits] = useState<Unit[]>([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<CategoryCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookingCategory, setBookingCategory] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const startDate = searchParams?.get('startDate');
  const endDate = searchParams?.get('endDate');
  const adults = searchParams?.get('adults') || '1';
  const children = searchParams?.get('children') || '0';
  const projectId = searchParams?.get('projectId');
  const sort = searchParams?.get('sort') || sortOptions[0]?.key || 'recommended';
  const hasDates = Boolean(startDate && endDate);

  /**
   * Which search the answers belong to. A slow first page must not overwrite a
   * faster second search — the guest would be looking at the results of a
   * question they have already changed.
   */
  const requestRef = useRef(0);

  const fetchPage = useCallback(
    async (offset: number) => {
      const generation = ++requestRef.current;
      if (offset === 0) setLoading(true);
      else setLoadingMore(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          startDate: startDate as string,
          endDate: endDate as string,
          adultsCount: adults,
          childrenCount: children,
          sort,
          limit: String(PAGE_SIZE),
          offset: String(offset),
        });
        if (projectId) params.set('projectId', projectId);

        const response = await fetch(`/api/search/units?${params}`);
        if (!response.ok) {
          throw new Error(labels.errorGeneric);
        }

        const data = await response.json();
        if (generation !== requestRef.current) return;

        setUnits((previous) => (offset === 0 ? data.units : [...previous, ...data.units]));
        setTotal(data.total);
        setSearched(true);

        // Category cards for project-scoped searches (LY-6) — the rollup is the
        // whole set, so it is fetched once with the first page, not with each.
        if (offset === 0) {
          if (projectId) {
            const grouped = new URLSearchParams(params);
            grouped.set('groupBy', 'category');
            const groupedRes = await fetch(`/api/search/units?${grouped}`);
            if (generation !== requestRef.current) return;
            const groupedData = groupedRes.ok ? await groupedRes.json() : null;
            setCategories(groupedData?.categories || []);
          } else {
            setCategories([]);
          }
        }
      } catch (err) {
        if (generation !== requestRef.current) return;
        setError(err instanceof Error ? err.message : labels.errorGeneric);
      } finally {
        if (generation === requestRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [startDate, endDate, adults, children, projectId, sort, labels.errorGeneric]
  );

  useEffect(() => {
    if (!hasDates) {
      requestRef.current++;
      setUnits([]);
      setTotal(0);
      setSearched(false);
      setError(null);
      return;
    }
    // Changing the dates, the party, or the ordering is a different question:
    // the answer starts again at page one rather than appending to the old one.
    fetchPage(0);
  }, [hasDates, fetchPage]);

  const handleSortChange = (nextSort: string) => {
    const next = new URLSearchParams(searchParams?.toString() || '');
    next.set('sort', nextSort);
    // In the URL, so the ordering survives a reload and travels in a shared link.
    router.replace(`/search?${next.toString()}`);
  };

  const handleBookCategory = async (categoryKey: string) => {
    if (!startDate || !endDate || !projectId) return;
    setBookingCategory(categoryKey);
    setError(null);
    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryKey,
          projectId,
          startDate,
          endDate,
          adultsCount: Number(adults),
          childrenCount: Number(children),
        }),
      });
      if (response.status === 401) {
        const next = `/search?${searchParams?.toString() || ''}`;
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
      setBookingCategory(null);
    }
  };

  return (
    <div className="min-h-screen bg-surface-background p-24 md:p-32">
      <div className="max-w-6xl mx-auto">
        <div className="mb-24">
          <h1 className="font-display text-display-xl font-semibold text-text-ink mb-16">{labels.title}</h1>
          <SearchBar
            projectId={projectId ?? undefined}
            labels={{
              checkIn: labels.barCheckIn,
              checkOut: labels.barCheckOut,
              adults: labels.barAdults,
              children: labels.barChildren,
              submit: labels.barSubmit,
            }}
            initialStartDate={startDate || ''}
            initialEndDate={endDate || ''}
            initialAdults={Number(adults) || 2}
            initialChildren={Number(children) || 0}
          />
        </div>

        {!hasDates && <p className="text-body text-text-secondary">{labels.prompt}</p>}

        {hasDates && (
          <div className="flex flex-wrap items-center justify-between gap-16 mb-24">
            <p className="text-body text-text-secondary">
              {fill(labels.resultsSummary, {
                from: startDate as string,
                to: endDate as string,
                guests: Number(adults) + Number(children),
              })}
            </p>
            {sortOptions.length > 0 && (
              <label className="flex items-center gap-8 text-small text-text-secondary">
                {labels.sortLabel}
                <select
                  value={sort}
                  onChange={(event) => handleSortChange(event.target.value)}
                  className="h-40 rounded-sm border border-border-line bg-surface-paper px-12 text-body text-text-ink"
                >
                  {sortOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}

        {loading && <p className="text-body text-text-secondary">{labels.loading}</p>}

        {error && (
          <div className="bg-state-error/10 border border-state-error rounded-lg p-16 mb-24">
            <p className="text-body text-state-error">{error}</p>
          </div>
        )}

        {!loading && categories.length > 0 && (
          <div className="mb-32">
            <h2 className="font-display text-display font-semibold text-text-ink mb-16">
              {labels.categoriesTitle}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-24">
              {categories.map((category) => (
                <div
                  key={category.category_key}
                  className="bg-surface-paper border border-border-line rounded-lg p-16"
                >
                  <h3 className="text-subtitle font-semibold text-text-ink mb-8">
                    {category.label}
                  </h3>
                  <p className="text-small text-text-secondary mb-8">
                    {fill(labels.categoryAvailable, { count: category.available_count })}
                  </p>
                  <p className="font-display text-title font-semibold text-brand-andaman mb-12 tabular-nums">
                    {fill(labels.categoryFrom, {
                      price: Math.round(category.from_nightly_thb / 100).toLocaleString(),
                    })}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleBookCategory(category.category_key)}
                    disabled={bookingCategory !== null}
                    className="w-full bg-brand-andaman text-surface-ivory rounded-sm h-48 font-semibold hover:opacity-90 transition disabled:opacity-50"
                  >
                    {bookingCategory === category.category_key
                      ? labels.categoryBooking
                      : labels.categoryBook}
                  </button>
                  <p className="text-small text-text-secondary mt-8">
                    {labels.categoryAutoAssign}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && searched && units.length === 0 && (
          <div className="bg-surface-paper border border-border-line rounded-lg p-32 text-center">
            <p className="text-body text-text-ink mb-8">{labels.empty}</p>
            <p className="text-small text-text-secondary">{labels.emptyHint}</p>
          </div>
        )}

        {!loading && units.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-24">
            {units.map((unit) => (
              <Link
                key={unit.id}
                href={`/units/${unit.id}?startDate=${startDate}&endDate=${endDate}&adults=${adults}&children=${children}`}
                className="bg-surface-paper border border-border-line rounded-lg overflow-hidden hover:shadow-card transition-shadow duration-micro"
              >
                {unit.coverUrl ? (
                  <Image
                    src={unit.coverUrl}
                    alt={unit.name}
                    width={640}
                    height={360}
                    className="aspect-video w-full object-cover"
                  />
                ) : (
                  <div className="aspect-video bg-gradient-to-br from-brand-andaman to-brand-andaman-dark" />
                )}
                <div className="p-16">
                  <h3 className="text-subtitle font-semibold text-text-ink mb-8">{unit.name}</h3>
                  <p className="font-display text-title font-semibold text-brand-andaman mb-4 tabular-nums">
                    ฿{unit.baseNightlyThb?.toLocaleString()}
                  </p>
                  <p className="text-small text-text-secondary">{labels.perNight}</p>
                  {/* A villa nobody has reviewed shows nothing, rather than a
                      zero — it is unknown, not bad. */}
                  {unit.averageRating !== null && unit.averageRating !== undefined && (
                    <p className="text-small text-text-secondary mt-8">
                      {fill(labels.ratingSummary, {
                        rating: unit.averageRating.toFixed(1),
                        count: unit.reviewCount ?? 0,
                      })}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}

        {!loading && units.length > 0 && (
          <div className="mt-32 text-center">
            <p className="text-small text-text-secondary mb-16">
              {fill(labels.showing, { shown: units.length, total })}
            </p>
            {units.length < total && (
              <button
                type="button"
                onClick={() => fetchPage(units.length)}
                disabled={loadingMore}
                className="h-48 px-24 rounded-sm border border-brand-andaman text-brand-andaman font-semibold hover:bg-brand-andaman/10 transition disabled:opacity-50"
              >
                {loadingMore ? labels.loadingMore : labels.loadMore}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
