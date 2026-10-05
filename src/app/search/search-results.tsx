'use client';


import { UI_LOCALE } from '@/lib/format';
import { useState, useEffect, useRef, useCallback } from 'react';
import { formatBaht } from '@/lib/money';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { SearchBar } from '@/components/SearchBar';
import { SearchResultsMap, type SearchMapProject } from '@/components/search/SearchResultsMap';

/** One screenful. Beyond this the guest asks for more rather than waiting for it. */
const PAGE_SIZE = 24;

interface Unit {
  id: string;
  name: string;
  baseNightlyThb: number;
  description?: string;
  projectId?: string;
  project?: { id: string; name: string; slug: string; latitude: number; longitude: number } | null;
  coverUrl?: string | null;
  /** Null when nobody has reviewed it — unknown, not zero. */
  averageRating?: number | null;
  reviewCount?: number;
}

interface CategoryCard {
  inventory_category_id: string;
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
  filterType: string;
  filterMin: string;
  filterMax: string;
  filterClear: string;
  filterBedrooms?: string;
  mapLoading: string;
  mapUnavailable: string;
  mapReset: string;
  mapResults: string;
  mapAria: string;
  mapHomes: string;
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

/** "10 нояб." / "Nov 10" — never the raw ISO date. Fixed noon avoids timezone day-shift. */
function formatStayDate(value: string, locale: string): string {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

export default function SearchResults({
  locale = 'en',
  labels,
  sortOptions,
  typeOptions,
}: {
  locale?: string;
  labels: SearchResultsLabels;
  sortOptions: SortOption[];
  typeOptions: { key: string; label: string }[];
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [units, setUnits] = useState<Unit[]>([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<CategoryCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [mapProjects, setMapProjects] = useState<SearchMapProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const startDate = searchParams?.get('startDate');
  const endDate = searchParams?.get('endDate');
  const adults = searchParams?.get('adults') || '1';
  const children = searchParams?.get('children') || '0';
  const projectId = searchParams?.get('projectId');
  const areaSlug = searchParams?.get('areaSlug');
  const stayMode = searchParams?.get('stayMode');
  const sort = searchParams?.get('sort') || sortOptions[0]?.key || 'recommended';
  const bedrooms = searchParams?.get('bedrooms') || '';
  const unitTypes = searchParams?.get('unitTypes') || '';
  const minPrice = searchParams?.get('minPrice') || '';
  const maxPrice = searchParams?.get('maxPrice') || '';
  const swLat = searchParams?.get('swLat') || '';
  const swLng = searchParams?.get('swLng') || '';
  const neLat = searchParams?.get('neLat') || '';
  const neLng = searchParams?.get('neLng') || '';
  const hasMapBounds = Boolean(swLat && swLng && neLat && neLng);
  const hasDates = Boolean(startDate && endDate);
  const selectedTypes = new Set(unitTypes.split(',').filter(Boolean));

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
        if (areaSlug) params.set('areaSlug', areaSlug);
        if (stayMode) params.set('stayMode', stayMode);
        if (bedrooms) params.set('bedrooms', bedrooms);
        if (unitTypes) params.set('unitTypes', unitTypes);
        if (minPrice) params.set('minPrice', minPrice);
        if (maxPrice) params.set('maxPrice', maxPrice);
        if (hasMapBounds) {
          params.set('swLat', swLat);
          params.set('swLng', swLng);
          params.set('neLat', neLat);
          params.set('neLng', neLng);
        }

        const response = await fetch(`/api/search/units?${params}`);
        if (!response.ok) {
          throw new Error(labels.errorGeneric);
        }

        const data = await response.json();
        if (generation !== requestRef.current) return;

        setUnits((previous) => (offset === 0 ? data.units : [...previous, ...data.units]));
        setMapProjects(Array.isArray(data.mapProjects) ? data.mapProjects : []);
        setTotal(data.total);
        setSearched(true);

        // Category rollup is secondary information. Do not keep the primary
        // unit cards behind a second pricing request: render the first page now,
        // then hydrate project-category choices independently.
        if (offset === 0) {
          if (projectId) {
            const grouped = new URLSearchParams(params);
            grouped.set('groupBy', 'category');
            void fetch(`/api/search/units?${grouped}`)
              .then(async (groupedRes) => groupedRes.ok ? groupedRes.json() : null)
              .then((groupedData) => {
                if (generation === requestRef.current) {
                  setCategories(groupedData?.categories || []);
                }
              })
              .catch(() => {
                if (generation === requestRef.current) setCategories([]);
              });
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
    [startDate, endDate, adults, children, projectId, areaSlug, stayMode, sort, bedrooms, unitTypes, minPrice, maxPrice, hasMapBounds, swLat, swLng, neLat, neLng, labels.errorGeneric]
  );

  useEffect(() => {
    if (!hasDates) {
      requestRef.current++;
      setUnits([]);
      setMapProjects([]);
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

  const replaceFilters = (mutate: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(searchParams?.toString() || '');
    mutate(next);
    router.replace(`/search?${next.toString()}`);
  };

  const toggleType = (key: string) => {
    replaceFilters((next) => {
      const current = new Set((next.get('unitTypes') || '').split(',').filter(Boolean));
      if (current.has(key)) current.delete(key);
      else current.add(key);
      if (current.size === 0) next.delete('unitTypes');
      else next.set('unitTypes', Array.from(current).join(','));
    });
  };

  const handleMapBoundsChange = useCallback(
    (bounds: { swLat: number; swLng: number; neLat: number; neLng: number }) => {
      const next = new URLSearchParams(window.location.search);
      const incoming = [bounds.swLat, bounds.swLng, bounds.neLat, bounds.neLng].map(String);
      const current = [next.get('swLat'), next.get('swLng'), next.get('neLat'), next.get('neLng')];
      if (incoming.every((value, index) => value === current[index])) return;
      next.set('swLat', incoming[0]);
      next.set('swLng', incoming[1]);
      next.set('neLat', incoming[2]);
      next.set('neLng', incoming[3]);
      router.replace(`/search?${next.toString()}`, { scroll: false });
    },
    [router]
  );

  const resetMapBounds = () =>
    replaceFilters((next) => {
      next.delete('swLat');
      next.delete('swLng');
      next.delete('neLat');
      next.delete('neLng');
    });

  const handleMapProjectSelect = useCallback(
    (selected: string) => {
      setSelectedProjectId(selected);
      const unit = units.find((candidate) => candidate.project?.id === selected);
      if (unit) {
        document
          .getElementById(`unit-card-${unit.id}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    },
    [units]
  );

  // Category booking is addressed by the canonical InventoryCategory id: the
  // review page quotes and signs only for that id. Sending the legacy
  // categoryKey here left the guest on a review page with no price and a
  // Confirm button that could never enable.
  const handleBookCategory = (inventoryCategoryId: string) => {
    if (!startDate || !endDate || !projectId) return;
    const next = new URLSearchParams({
      inventoryCategoryId,
      projectId,
      startDate,
      endDate,
      adults,
      children,
    });
    router.push(`/book/review?${next.toString()}`);
  };

  return (
    <div className="min-h-screen bg-surface-ivory p-24 md:p-32">
      <div className="mx-auto max-w-content">
        <div className="mb-24">
          <h1 className="font-display text-display-xl font-semibold text-text-ink mb-16">{labels.title}</h1>
          <SearchBar
            projectId={projectId ?? undefined}
            areaSlug={areaSlug ?? undefined}
            stayMode={stayMode ?? undefined}
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
                from: formatStayDate(startDate as string, locale),
                to: formatStayDate(endDate as string, locale),
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

        {hasDates && (
          <div className="mb-24 space-y-16">
            <div>
              <p className="mb-8 text-small text-text-stone">{labels.filterType}</p>
              <div className="flex flex-wrap gap-8">
                {typeOptions.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => toggleType(option.key)}
                    className={
                      selectedTypes.has(option.key)
                        ? 'rounded-full bg-brand-andaman px-16 py-8 text-small text-on-dark-text'
                        : 'rounded-full border border-border-line bg-surface-paper px-16 py-8 text-small text-text-ink'
                    }
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-12">
              {bedrooms && <p className="text-small text-text-stone">{labels.filterBedrooms || 'Bedrooms'}: {bedrooms}</p>}
              <label className="text-small text-text-stone">
                {labels.filterMin}
                <input
                  type="number"
                  min={0}
                  value={minPrice}
                  onChange={(event) =>
                    replaceFilters((next) => {
                      if (event.target.value) next.set('minPrice', event.target.value);
                      else next.delete('minPrice');
                    })
                  }
                  className="mt-4 block h-40 w-[120px] rounded-sm border border-border-line bg-surface-paper px-12 text-body text-text-ink"
                />
              </label>
              <label className="text-small text-text-stone">
                {labels.filterMax}
                <input
                  type="number"
                  min={0}
                  value={maxPrice}
                  onChange={(event) =>
                    replaceFilters((next) => {
                      if (event.target.value) next.set('maxPrice', event.target.value);
                      else next.delete('maxPrice');
                    })
                  }
                  className="mt-4 block h-40 w-[120px] rounded-sm border border-border-line bg-surface-paper px-12 text-body text-text-ink"
                />
              </label>
              {(bedrooms || unitTypes || minPrice || maxPrice) && (
                <button
                  type="button"
                  onClick={() =>
                    replaceFilters((next) => {
                      next.delete('unitTypes');
                      next.delete('minPrice');
                      next.delete('maxPrice');
                      next.delete('bedrooms');
                    })
                  }
                  className="h-40 text-small font-semibold text-brand-andaman hover:underline"
                >
                  {labels.filterClear}
                </button>
              )}
            </div>
          </div>
        )}

        {loading && (
          <div aria-label={labels.loading} className="grid gap-16 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="overflow-hidden rounded-md border border-border-line bg-surface-paper">
                <div className="aspect-video animate-pulse bg-border-line/60" />
                <div className="space-y-12 p-16">
                  <div className="h-16 w-[42%] animate-pulse rounded-full bg-border-line/70" />
                  <div className="h-20 w-[68%] animate-pulse rounded-full bg-border-line/70" />
                  <div className="h-16 w-[34%] animate-pulse rounded-full bg-border-line/70" />
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="bg-state-error/10 border border-state-error rounded-md p-16 mb-24">
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
                  key={category.inventory_category_id}
                  className="bg-surface-paper border border-border-line rounded-md p-16"
                >
                  <h3 className="text-subtitle font-semibold text-text-ink mb-8">
                    {category.label}
                  </h3>
                  <p className="text-small text-text-secondary mb-8">
                    {fill(labels.categoryAvailable, { count: category.available_count })}
                  </p>
                  <p className="font-display text-title font-semibold text-brand-andaman mb-12 tabular-nums">
                    {fill(labels.categoryFrom, {
                      price: Math.round(category.from_nightly_thb / 100).toLocaleString(UI_LOCALE),
                    })}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleBookCategory(category.inventory_category_id)}
                    className="w-full bg-brand-andaman text-surface-ivory rounded-sm h-48 font-semibold hover:opacity-90 transition"
                  >
                    {labels.categoryBook}
                  </button>
                  <p className="text-small text-text-secondary mt-8">
                    {labels.categoryAutoAssign}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && searched && (
          <section className="grid gap-24 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
            <div>
              <div className="mb-12 flex flex-wrap items-center justify-between gap-8">
                <p className="text-small text-text-secondary">
                  {fill(labels.mapResults, { shown: units.length, total })}
                </p>
                {hasMapBounds ? (
                  <button
                    type="button"
                    onClick={resetMapBounds}
                    className="text-small font-semibold text-brand-andaman hover:underline"
                  >
                    {labels.mapReset}
                  </button>
                ) : null}
              </div>

              {units.length === 0 ? (
                <div className="rounded-md border border-border-line bg-surface-paper p-32 text-center">
                  <p className="mb-8 text-body text-text-ink">{labels.empty}</p>
                  <p className="text-small text-text-secondary">{labels.emptyHint}</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
                    {units.map((unit) => (
                      <Link
                        id={`unit-card-${unit.id}`}
                        key={unit.id}
                        href={`/units/${unit.id}?${new URLSearchParams({
                          startDate: startDate || '',
                          endDate: endDate || '',
                          adults,
                          children,
                          ...(projectId ? { projectId } : {}),
                          ...(areaSlug ? { areaSlug } : {}),
                          ...(stayMode ? { stayMode } : {}),
                        }).toString()}`}
                        onMouseEnter={() => setSelectedProjectId(unit.project?.id ?? null)}
                        onFocus={() => setSelectedProjectId(unit.project?.id ?? null)}
                        className={
                          selectedProjectId && selectedProjectId === unit.project?.id
                            ? 'overflow-hidden rounded-lg border-2 border-brand-sun bg-surface-paper shadow-card'
                            : 'overflow-hidden rounded-md border border-border-line bg-surface-paper transition-shadow duration-micro hover:shadow-card'
                        }
                      >
                        {unit.coverUrl ? (
                          <Image
                            src={unit.coverUrl}
                            alt={unit.name}
                            width={640}
                            height={360}
                            className="aspect-[4/3] w-full object-cover transition-transform duration-structural group-hover:scale-[1.02]"
                          />
                        ) : (
                          <div className="aspect-[4/3] bg-gradient-to-br from-surface-paper to-border-line" />
                        )}
                        <div className="p-16">
                          {unit.project?.name ? (
                            <p className="mb-4 text-small text-text-secondary">{unit.project.name}</p>
                          ) : null}
                          <h3 className="mb-8 text-subtitle font-semibold text-text-ink">{unit.name}</h3>
                          <p className="mb-4 font-display text-title font-semibold tabular-nums text-text-ink">
                            {formatBaht(unit.baseNightlyThb ?? 0)}
                          </p>
                          <p className="text-small text-text-secondary">{labels.perNight}</p>
                          {unit.averageRating !== null && unit.averageRating !== undefined && (
                            <p className="mt-8 text-small text-text-secondary">
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

                  <div className="mt-32 text-center">
                    <p className="mb-16 text-small text-text-secondary">
                      {fill(labels.showing, { shown: units.length, total })}
                    </p>
                    {units.length < total && (
                      <button
                        type="button"
                        onClick={() => fetchPage(units.length)}
                        disabled={loadingMore}
                        className="h-48 rounded-sm border border-brand-andaman px-24 font-semibold text-brand-andaman transition hover:bg-brand-andaman/10 disabled:opacity-50"
                      >
                        {loadingMore ? labels.loadingMore : labels.loadMore}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            <SearchResultsMap
              projects={mapProjects}
              selectedProjectId={selectedProjectId}
              onSelectProject={handleMapProjectSelect}
              onBoundsChange={handleMapBoundsChange}
              labels={{ loading: labels.mapLoading, unavailable: labels.mapUnavailable, homes: labels.mapHomes, aria: labels.mapAria }}
              fitToProjects={!hasMapBounds}
            />
          </section>
        )}
      </div>
    </div>
  );
}
