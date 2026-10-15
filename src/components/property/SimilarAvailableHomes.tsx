'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { PropertyImage } from './PropertyImage';
import { formatBaht } from '@/lib/money';
import type { GuestSearchCopy } from '@/modules/content/guest-search-ux.seed';

type Alternative = { id: string; name: string; coverUrl?: string | null; maxGuests?: number; pricing?: { stayTotalThb: number | null }; };

/** Recommendations are available, canonically quoted search results, never a static similar-property shelf. */
export function alternativeSearchQuery(input: URLSearchParams, nightlyBaht?: number | null) {
  const query = new URLSearchParams();
  for (const key of ['startDate', 'endDate', 'areaSlug', 'bedrooms', 'unitTypes', 'amenities', 'minPrice', 'maxPrice']) {
    const value = input.get(key);
    if (value) query.set(key, value);
  }
  query.set('adultsCount', input.get('adults') || '1');
  query.set('childrenCount', input.get('children') || '0');
  if (!input.get('minPrice') && !input.get('maxPrice') && nightlyBaht && Number.isFinite(nightlyBaht) && nightlyBaht > 0) {
    query.set('minPrice', String(Math.floor(nightlyBaht * 0.7)));
    query.set('maxPrice', String(Math.ceil(nightlyBaht * 1.3)));
  }
  query.set('sort', 'price_asc');
  query.set('limit', '12');
  return query;
}

export function SimilarAvailableHomes({ unitId, nightlyBaht, copy, photoLabel }: {
  unitId: string; nightlyBaht?: number | null; copy: GuestSearchCopy; photoLabel: string;
}) {
  const params = useSearchParams();
  const input = new URLSearchParams(params?.toString() || '');
  const dated = Boolean(input.get('startDate') && input.get('endDate') && input.get('endDate')! > input.get('startDate')!);
  const query = alternativeSearchQuery(input, nightlyBaht).toString();
  const [result, setResult] = useState<{ query: string; homes: Alternative[]; error: boolean } | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!dated) return;
    const controller = new AbortController();
    setResult(null);
    fetch(`/api/search/units?${query}`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('search failed');
        const data = await response.json();
        if (!Array.isArray(data.units)) throw new Error('invalid search result');
        const requested = new URLSearchParams(query);
        const guests = Number(requested.get('adultsCount') || 1) + Number(requested.get('childrenCount') || 0);
        const homes = (data.units as Alternative[]).filter(home => home.id !== unitId &&
          Number(home.maxGuests) >= guests && typeof home.pricing?.stayTotalThb === 'number' && Number.isFinite(home.pricing.stayTotalThb) && home.pricing.stayTotalThb > 0).slice(0, 3);
        if (!controller.signal.aborted) setResult({ query, homes, error: false });
      }).catch(() => { if (!controller.signal.aborted) setResult({ query, homes: [], error: true }); });
    return () => controller.abort();
  }, [query, unitId, dated, attempt]);
  if (!dated) return null;
  const current = result?.query === query ? result : null;
  return <section className="mx-auto max-w-content px-20 py-32 md:px-32" aria-label={copy.similar}>
    <h2 className="font-display text-heading-2 font-semibold text-text-ink">{copy.similar}</h2>
    <p className="mt-8 text-small text-text-secondary">{copy.similarNote}</p>
    {!current ? <p role="status" className="mt-16">{copy.checking}</p> : current.error ? <div role="alert" className="mt-16">{copy.error} <button type="button" onClick={() => setAttempt(value => value + 1)} className="min-h-44 px-12 font-semibold text-brand-andaman underline">{copy.retry}</button></div> : !current.homes.length ? <p role="status" className="mt-16 text-text-secondary">{copy.empty}</p> : <div className="mt-24 grid gap-16 sm:grid-cols-3">{current.homes.map(home => {
      const linkQuery = new URLSearchParams(params?.toString() || '');
      linkQuery.delete('projectId'); linkQuery.delete('inventoryCategoryId');
      return <Link key={home.id} href={`/units/${encodeURIComponent(home.id)}?${linkQuery}`} className="overflow-hidden rounded-lg border border-border-line bg-surface-paper shadow-card focus-visible:outline-brand-andaman">
        {home.coverUrl ? <PropertyImage src={home.coverUrl} alt={home.name} fallbackLabel={photoLabel} width={640} height={480} className="aspect-[4/3] w-full object-cover" /> : <div className="flex aspect-[4/3] items-center justify-center bg-surface-sand">{photoLabel}</div>}
        <div className="p-16"><h3 className="font-semibold">{home.name}</h3><p className="mt-8 text-small text-text-secondary">{copy.total}</p><p className="font-semibold">{formatBaht(home.pricing!.stayTotalThb!)}</p><p className="mt-12 text-small font-semibold text-brand-andaman">{copy.view} →</p></div>
      </Link>;
    })}</div>}
  </section>;
}
