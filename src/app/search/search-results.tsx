'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { SearchBar } from '@/components/SearchBar';

interface Unit {
  id: string;
  name: string;
  baseNightlyThb: number;
  description?: string;
  projectId?: string;
  coverUrl?: string | null;
}

interface SearchResult {
  units: Unit[];
  total: number;
  limit: number;
  offset: number;
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

export default function SearchResults({ labels }: { labels: SearchResultsLabels }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [results, setResults] = useState<SearchResult | null>(null);
  const [categories, setCategories] = useState<CategoryCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookingCategory, setBookingCategory] = useState<string | null>(null);

  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const adults = searchParams.get('adults') || '1';
  const children = searchParams.get('children') || '0';
  const projectId = searchParams.get('projectId');
  const hasDates = Boolean(startDate && endDate);

  useEffect(() => {
    if (!hasDates) {
      setResults(null);
      setError(null);
      return;
    }

    const fetchResults = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          startDate: startDate as string,
          endDate: endDate as string,
          adultsCount: adults,
          childrenCount: children,
          limit: '50',
        });
        if (projectId) params.set('projectId', projectId);

        const response = await fetch(`/api/search/units?${params}`);
        if (!response.ok) {
          throw new Error(labels.errorGeneric);
        }

        const data = await response.json();
        setResults(data);

        // Category cards for project-scoped searches (LY-6)
        if (projectId) {
          const grouped = new URLSearchParams(params);
          grouped.set('groupBy', 'category');
          const groupedRes = await fetch(`/api/search/units?${grouped}`);
          if (groupedRes.ok) {
            const groupedData = await groupedRes.json();
            setCategories(groupedData.categories || []);
          } else {
            setCategories([]);
          }
        } else {
          setCategories([]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : labels.errorGeneric);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [hasDates, startDate, endDate, adults, children, projectId, labels.errorGeneric]);

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
        const next = `/search?${searchParams.toString()}`;
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
          <h1 className="text-heading-1 font-bold text-text-ink mb-16">{labels.title}</h1>
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
          <p className="text-body text-text-secondary mb-24">
            {fill(labels.resultsSummary, {
              from: startDate as string,
              to: endDate as string,
              guests: Number(adults) + Number(children),
            })}
          </p>
        )}

        {loading && <p className="text-body text-text-secondary">{labels.loading}</p>}

        {error && (
          <div className="bg-state-error/10 border border-state-error rounded-lg p-16 mb-24">
            <p className="text-body text-state-error">{error}</p>
          </div>
        )}

        {!loading && categories.length > 0 && (
          <div className="mb-32">
            <h2 className="text-heading-2 font-bold text-text-ink mb-16">
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
                  <p className="text-heading-3 font-bold text-brand-andaman mb-12">
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

        {!loading && results && results.units.length === 0 && (
          <div className="bg-surface-paper border border-border-line rounded-lg p-32 text-center">
            <p className="text-body text-text-ink mb-8">{labels.empty}</p>
            <p className="text-small text-text-secondary">{labels.emptyHint}</p>
          </div>
        )}

        {!loading && results && results.units.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-24">
            {results.units.map((unit) => (
              <Link
                key={unit.id}
                href={`/units/${unit.id}?startDate=${startDate}&endDate=${endDate}&adults=${adults}&children=${children}`}
                className="bg-surface-paper border border-border-line rounded-lg overflow-hidden hover:shadow-lg transition"
              >
                {unit.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={unit.coverUrl}
                    alt={unit.name}
                    className="aspect-video w-full object-cover"
                  />
                ) : (
                  <div className="aspect-video bg-gradient-to-br from-brand-andaman to-brand-andaman-dark" />
                )}
                <div className="p-16">
                  <h3 className="text-subtitle font-semibold text-text-ink mb-8">{unit.name}</h3>
                  <p className="text-heading-3 font-bold text-brand-andaman mb-4">
                    ฿{unit.baseNightlyThb?.toLocaleString()}
                  </p>
                  <p className="text-small text-text-secondary">{labels.perNight}</p>
                </div>
              </Link>
            ))}
          </div>
        )}

        {!loading && results && results.total > results.limit && (
          <div className="mt-32 text-center">
            <p className="text-small text-text-secondary">
              {fill(labels.showing, { shown: results.units.length, total: results.total })}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
