'use client';

import Image from 'next/image';
import Link from 'next/link';
import { HOME_INTENTS, homeCatalogHref, useHomeIntent, type HomeIntent } from './HomeIntentProvider';

const IMAGE_SIZES = '(max-width: 768px) 280px, (max-width: 1024px) 50vw, 33vw';

export type OfferPriceMode = 'base_nightly' | 'monthly' | 'sale' | 'on_request';

export interface HomeOfferItem {
  key: string;
  intent: HomeIntent;
  name: string;
  projectName: string;
  projectId: string;
  areaSlug?: string | null;
  href: string;
  imageSrc: string;
  imageIllustrative: boolean;
  bedrooms: number;
  bathrooms: number;
  sizeSqm?: number | null;
  guests?: number | null;
  /** How the price should be read — an indicative base rate is not a quote. */
  priceMode: OfferPriceMode;
  priceText: string;
  priceNote?: string;
}

export interface HomeOffersLabels {
  tablist: string;
  mode: Record<HomeIntent, string>;
  title: Record<HomeIntent, string>;
  body: Record<HomeIntent, string>;
  cta: Record<HomeIntent, string>;
  empty: string;
  bedrooms: string;
  bathrooms: string;
  sqm: string;
  guests: string;
  open: string;
  noPhoto: string;
}

const MAX_VISIBLE = 6;

export function HomeOffersRail({ items, labels }: { items: HomeOfferItem[]; labels: HomeOffersLabels }) {
  const { intent, setIntent, place, search } = useHomeIntent();
  const visible = items
    .filter((item) => item.intent === intent)
    .filter((item) => {
      if (!place) return true;
      return place.kind === 'project'
        ? item.projectId === place.id
        : Boolean(place.slug) && item.areaSlug === place.slug;
    })
    .slice(0, MAX_VISIBLE);
  const catalogHref = homeCatalogHref(intent, place, search);

  const contextualHref = (item: HomeOfferItem) => {
    if (item.intent !== 'stay' || !search.startDate || !search.endDate) return item.href;
    const url = new URL(item.href, 'https://myuno.local');
    url.searchParams.set('startDate', search.startDate);
    url.searchParams.set('endDate', search.endDate);
    url.searchParams.set('adults', String(Math.max(1, search.adults)));
    url.searchParams.set('children', String(Math.max(0, search.children)));
    return url.pathname + '?' + url.searchParams.toString();
  };

  return (
    <div>
      <div className="mb-32 flex flex-col justify-between gap-16 md:mb-40 md:flex-row md:items-end">
        <div className="max-w-2xl">
          <h2
            id="offers-heading"
            className="mt-8 font-display text-display-xl font-semibold text-text-ink"
          >
            {labels.title[intent]}
          </h2>
          <p className="mt-12 max-w-xl text-body text-text-secondary">{labels.body[intent]}</p>
        </div>
        <Link href={catalogHref} className="shrink-0 text-body font-semibold text-brand-andaman hover:underline">
          {labels.cta[intent]} →
        </Link>
      </div>

      <div className="mb-24 flex flex-wrap gap-8" role="group" aria-label={labels.tablist}>
        {HOME_INTENTS.map((mode) => (
          <button
            key={mode}
            type="button"
            aria-pressed={intent === mode}
            onClick={() => setIntent(mode)}
            className={`min-h-44 rounded-full px-16 text-small font-semibold transition-colors duration-micro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-andaman ${
              intent === mode
                ? 'bg-brand-andaman text-white'
                : 'border border-border-line bg-surface-paper text-text-secondary hover:text-text-ink'
            }`}
          >
            {labels.mode[mode]}
          </button>
        ))}
      </div>

      {visible.length ? (
        <div className="-mx-20 flex snap-x gap-16 overflow-x-auto px-20 pb-8 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 lg:grid-cols-3">
          {visible.map((item) => (
            <Link
              key={item.key}
              href={contextualHref(item)}
              className="group w-[280px] shrink-0 snap-start overflow-hidden rounded-2xl border border-border-line bg-surface-paper transition-shadow duration-structural hover:shadow-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-andaman md:w-auto"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-brand-deep">
                <Image
                  src={item.imageSrc}
                  alt={item.imageIllustrative ? '' : item.name}
                  fill
                  sizes={IMAGE_SIZES}
                  className="object-cover transition-transform duration-structural group-hover:scale-[1.02]"
                />
                {item.imageIllustrative ? (
                  <span className="absolute right-12 top-12 rounded-full bg-black/40 px-12 py-4 text-small text-white/80 backdrop-blur">
                    {labels.noPhoto}
                  </span>
                ) : null}
              </div>
              <div className="p-20">
                <p className="text-small font-semibold text-brand-andaman">{item.projectName}</p>
                <h3 className="mt-4 font-display text-title font-semibold text-text-ink">{item.name}</h3>
                <p className="mt-8 text-small text-text-secondary">
                  {item.bedrooms} {labels.bedrooms} · {item.bathrooms} {labels.bathrooms}
                  {item.sizeSqm ? ` · ${item.sizeSqm} ${labels.sqm}` : ''}
                  {item.guests ? ` · ${labels.guests.replace('{count}', String(item.guests))}` : ''}
                </p>
                <div className="mt-16 flex items-end justify-between gap-12">
                  <div className="min-w-0">
                    <p className="font-display text-body-strong tabular-nums text-text-ink">{item.priceText}</p>
                    {item.priceNote ? (
                      <p className="mt-4 text-small text-text-secondary">{item.priceNote}</p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-small font-semibold text-brand-andaman">{labels.open} →</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-border-line bg-surface-paper p-24 text-small text-text-secondary">
          {labels.empty}
        </div>
      )}
    </div>
  );
}
